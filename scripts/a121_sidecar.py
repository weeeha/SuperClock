#!/usr/bin/env python3
"""A121 exploration-server sidecar for SuperClock.

Bridges the Waveshare A121 mmWave module (running Acconeer's exploration-server
firmware, the default ship) to the SuperClock Express server. The module streams
raw radar data over USB-C; the DSP that turns it into presence / breathing runs
here, in acconeer-exptool (Python), because reimplementing Acconeer's algorithms
in TypeScript is not realistic. See docs/radar/a121-integration.md.

One sidecar runs ONE mode (presence or breathing). The Node driver
(server/radar/driver.ts) switches modes by restarting this process with a
different RADAR_START_MODE — far more robust than switching detectors in-process,
which desyncs the exploration protocol stream.

Contract with the driver:
  - One JSON object per line on stdout.
  - Frames:
      {"present": true, "distanceMm": 720, "intra": 1.9, "inter": 0.4}
      {"present": true, "distanceMm": 680, "breathingRpm": 13.4,
       "breathingConfidence": 0.9, "state": "estimate_breathing_rate"}
  - Lifecycle:
      {"status": "ready", "mode": "presence"}
      {"status": "error", "message": "..."}   (then exit non-zero)
  - We exit cleanly when stdin closes (parent gone) so no orphan holds the port.

Baud is pinned to 115200. exptool otherwise upgrades the link to the server's
2 Mbaud max for streaming, but a sidecar killed mid-session leaves the server
stuck at that baud, and recovery at the default 115200 then reads garbage.
Pinning one baud makes streaming and crash-recovery share the same known rate;
115200 sustains ~8 fps, which is ample for presence and breathing.

Env:
  RADAR_PORT        serial device (default /dev/ttyACM0 — CH342 SERIAL-A)
  RADAR_SENSOR_ID   A121 sensor id on the module (default 1)
  RADAR_START_MODE  "presence" (default) or "breathing"
"""
from __future__ import annotations

import json
import math
import os
import select
import signal
import sys
import time

import serial

from acconeer.exptool import a121
from acconeer.exptool.a121.algo.breathing import RefApp, RefAppConfig
from acconeer.exptool.a121.algo.presence import Detector, DetectorConfig

PORT = os.environ.get("RADAR_PORT", "/dev/ttyACM0")
SENSOR_ID = int(os.environ.get("RADAR_SENSOR_ID", "1"))
BAUD = 115200
STOP_STREAMING = b'{"cmd":"stop_streaming"}\n'
CONNECT_ATTEMPTS = 6


def emit(obj: dict) -> None:
    """One compact JSON object per line, flushed so the parent sees it live."""
    try:
        sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
        sys.stdout.flush()
    except BrokenPipeError:
        # The driver closed our stdout — it is gone. Exit quietly without the
        # interpreter's shutdown flush retrying the broken pipe.
        os._exit(0)


def log(msg: str) -> None:
    sys.stderr.write(f"[a121-sidecar] {msg}\n")
    sys.stderr.flush()


def m_to_mm(value) -> "int | None":
    if value is None:
        return None
    try:
        return int(round(float(value) * 1000.0))
    except (TypeError, ValueError):
        return None


def finite(value, default=0.0) -> float:
    """Coerce to a finite float. Non-finite floats (NaN/Inf — which the DSP can
    briefly produce) serialize to the invalid JSON tokens NaN/Infinity, and the
    driver's JSON.parse would then drop the WHOLE line, losing that frame's
    present/distance too. Fall back to `default` instead."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return default
    return f if math.isfinite(f) else default


def presence_config() -> DetectorConfig:
    # Desk-scale coverage: from ~0.3 m (leaning in) out to 2.5 m (across a room).
    return DetectorConfig(start_m=0.3, end_m=2.5, frame_rate=12.0)


def breathing_config() -> RefAppConfig:
    # Respiration needs the subject close and still; analyse a tighter range.
    return RefAppConfig(start_m=0.3, end_m=1.5)


def reset_port() -> None:
    """Put the module's serial line into a clean, quiet state before opening.

    Pulse DTR/RTS, send an explicit stop_streaming in case a prior session was
    left running, then drain until the line is quiet for a full read interval so
    no trailing frame bytes leak into the next handshake. Done at the pinned baud
    so a mid-session crash (which leaves the server streaming at this same baud)
    recovers cleanly."""
    try:
        s = serial.Serial(PORT, BAUD, timeout=0.3)
        s.dtr = False
        s.rts = False
        time.sleep(0.2)
        s.dtr = True
        s.rts = True
        time.sleep(0.4)
        s.reset_input_buffer()
        s.write(STOP_STREAMING)
        s.flush()
        time.sleep(0.4)
        deadline = time.time() + 5.0
        while time.time() < deadline:
            if s.read(4096):
                continue
            if not s.read(1):  # 0.3s of continuous silence = quiet
                break
        s.close()
    except Exception as exc:
        log(f"port reset skipped: {exc}")


def build_controller(client: a121.Client, mode: str):
    if mode == "breathing":
        return RefApp(
            client=client, sensor_id=SENSOR_ID, ref_app_config=breathing_config()
        )
    return Detector(
        client=client, sensor_id=SENSOR_ID, detector_config=presence_config()
    )


def connect(mode: str):
    """Reset, open (baud-pinned), and start `mode`, retrying the whole sequence.

    A wedged server desyncs the first attempt; a fresh reset+open+start realigns,
    so retry with a full teardown between tries. Returns (client, controller)."""
    last = None
    for attempt in range(1, CONNECT_ATTEMPTS + 1):
        reset_port()
        client = None
        try:
            client = a121.Client.open(serial_port=PORT, override_baudrate=BAUD)
            info = client.server_info
            controller = build_controller(client, mode)
            controller.start()
            log(f"connected rss={info.rss_version} sensors={info.connected_sensors}")
            return client, controller
        except Exception as exc:
            last = exc
            log(f"connect attempt {attempt}/{CONNECT_ATTEMPTS}: {exc}")
            if client is not None:
                try:
                    client.close()
                except Exception:
                    pass
            time.sleep(1.0)
    raise last if last else RuntimeError("connect failed")


def emit_presence(r) -> None:
    present = bool(r.presence_detected)
    emit(
        {
            "present": present,
            "distanceMm": m_to_mm(r.presence_distance) if present else None,
            "intra": round(finite(r.intra_presence_score), 3),
            "inter": round(finite(r.inter_presence_score), 3),
        }
    )


def emit_breathing(r) -> None:
    pres = r.presence_result
    present = bool(getattr(pres, "presence_detected", False))
    out = {
        "present": present,
        "distanceMm": m_to_mm(getattr(pres, "presence_distance", None))
        if present
        else None,
        "state": str(r.app_state).split(".")[-1].lower(),
    }
    rate = None
    if r.breathing_result is not None:
        rate = r.breathing_result.breathing_rate
    if rate is not None and math.isfinite(rate):
        out["breathingRpm"] = round(float(rate), 1)
        # The ref app has no scalar confidence; a rate only exists once locked
        # on, so surface a steady high confidence whenever one is present.
        out["breathingConfidence"] = 0.9
    emit(out)


def parent_gone() -> bool:
    """True once stdin closes — the driver has exited, so we should too."""
    if select.select([sys.stdin], [], [], 0)[0]:
        return sys.stdin.readline() == ""
    return False


def main() -> int:
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    mode = os.environ.get("RADAR_START_MODE", "presence")
    if mode not in ("presence", "breathing"):
        mode = "presence"

    log(f"opening {PORT} in {mode} mode")
    try:
        client, controller = connect(mode)
    except Exception as exc:
        emit({"status": "error", "message": f"connect failed: {exc}"})
        log(f"connect failed: {exc}")
        return 1

    emit({"status": "ready", "mode": mode})
    emit_fn = emit_breathing if mode == "breathing" else emit_presence
    rc = 0
    try:
        while True:
            if parent_gone():
                log("stdin closed — parent gone, exiting")
                break
            emit_fn(controller.get_next())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        emit({"status": "error", "message": str(exc)})
        log(f"fatal: {exc}")
        rc = 1

    try:
        controller.stop()
    except Exception:
        pass
    try:
        client.close()
    except Exception:
        pass
    return rc


if __name__ == "__main__":
    sys.exit(main())
