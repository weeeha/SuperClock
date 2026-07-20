# A121 mmWave radar integration

SuperClock supports the Waveshare **A121 Range Sensor** (60 GHz pulsed
coherent radar, Acconeer A121 + STM32L431) for presence wake/sleep and the
Breathing app. It is connected to **fastclock** (the Pi 5) over USB-C.

## Hardware

- Connect the module to the Pi over **USB-C**. Its CH342 chip enumerates as a
  dual serial port (`/dev/ttyACM0` = SERIAL-A + `/dev/ttyACM1` = SERIAL-B,
  stable paths under `/dev/serial/by-id/usb-1a86_USB_Dual_Serial_*`), powered
  from the same cable. The exploration-server firmware talks on **`ttyACM0`**.
- Field of view is 53°×65°; presence detection works to a few metres,
  breathing detection wants the subject within ~0.3–1.5 m, sitting still. The
  sensor works through plastic, so it can sit behind the clock's bezel.

## How it actually talks (important)

The A121 does **not** free-stream over USB. Its firmware is flash-selectable
into three families (all present in Waveshare's `A121_Firmware.zip`):

- **exploration server** (`acc_exploration_server_a121.bin`) — the default
  ship. The module streams raw radar data; the host runs the DSP. This is what
  we use.
- **UART firmware** (`example_detector_presence.bin`, `ref_app_breathing.bin`,
  …) — prints results as text over `ttyACM1`. One app per flash.
- **I2C firmware** (`i2c_presence_detector.bin`, …) — register protocol over
  the module's I2C **pins** + a BUSY GPIO, not USB.

We run the exploration server because it is the **only** option that serves
presence *and* breathing from one firmware and can switch between them at
runtime — every other build is one-app-per-flash. The trade-off is that the
DSP runs host-side, in Python.

## Architecture

```
A121 module ──USB serial (exploration protocol, 115200)──► scripts/a121_sidecar.py
                                                            (acconeer-exptool DSP)
                                                                   │ JSON lines (stdout)
                                                                   ▼
server/radar/driver.ts  ExplorationSidecarDriver  (spawns + parses the sidecar)
server/radar/protocol.ts  parseSidecarLine → RadarEvent
server/radar/service.ts   snapshot + mode lease
        │                        │
  /api/radar/* routes     display-adapter (panel power)
        │
  kiosk: src/core/radar.ts (SSE store) ─► PresenceShade, Breathing app
```

- **`scripts/a121_sidecar.py`** connects to the module with `acconeer-exptool`,
  runs the presence `Detector` or the breathing `RefApp`, and prints one JSON
  object per radar frame on stdout (`{"present":…,"distanceMm":…}` /
  `{"breathingRpm":…}`). It runs **one mode per process**.
- **`ExplorationSidecarDriver`** owns that child process. It switches modes by
  **restarting the sidecar** with a different `RADAR_START_MODE` — switching
  detectors in-process desyncs the exploration stream, whereas a fresh
  single-mode process reconnects reliably (a mode switch shows a ~3–4 s
  `available:false` gap while it reconnects).
- **Baud is pinned to 115200.** exptool otherwise upgrades the link to the
  server's 2 Mbaud max for streaming, but a sidecar killed mid-session leaves
  the server stuck at that baud and recovery at the default 115200 reads
  garbage. One pinned baud makes streaming *and* crash-recovery share the same
  rate. 115200 sustains ~8 fps — ample for presence and breathing. Recovery
  also sends an explicit `stop_streaming` and drains the line to silence before
  reopening (`reset_port` in the sidecar).

### API surface (unchanged)

- `GET /api/radar` — current `RadarSnapshot` (`src/shared/radar.ts`).
- `GET /api/radar/stream` — SSE stream of snapshot updates.
- `POST /api/radar/mode {"mode":"breathing"|"presence"}` — the Breathing app
  leases breathing mode while active; the lease expires 90 s after the last
  renewal and the sensor reverts to presence mode.
- `GET /api/occupancy` — desk-occupancy summary (`src/shared/occupancy.ts`)
  derived from presence transitions by `server/occupancy/service.ts`: today's
  at-desk total, per-hour buckets, and a 7-day history. Sessions persist to
  `config/occupancy.json` (gitignored, 30 days kept); dropouts shorter than
  60 s merge into the surrounding session. Consumed by the Time Tracking app,
  which also auto-pauses its Pomodoro timer after 45 s of radar absence and
  auto-resumes on return.

## Behavior

- **Presence wake/sleep** (when the radar is delivering data and
  `settings.presence.enabled` isn't `false`):
  - Outside the sleep window the panel blanks after
    `settings.presence.absentAfterMin` (default 10) minutes of absence and
    wakes immediately on approach. The kiosk also fades to black client-side
    (`PresenceShade`) so the behavior works in dev and reacts instantly.
  - Inside the sleep window the panel is off, but an approach wakes it for
    60 s past the last presence.
  - Without a radar, behavior is unchanged (sleep schedule only).
- **Breathing app** — shows live respiration rate. A locked rate needs the
  subject sitting still within ~0.3–1.5 m for ~30–60 s; until then the app
  shows "Hold still… measuring".

## On-device setup (fastclock)

The sidecar needs `acconeer-exptool` (+ `scipy`) in a venv the server can
reach:

```bash
python3 -m venv ~/radar-venv
~/radar-venv/bin/pip install acconeer-exptool scipy
```

The server finds the interpreter via `RADAR_PYTHON` in `~/SuperClock/.env`
(loaded by `superclock.service`):

```
RADAR_PYTHON=/home/nickv2026/radar-venv/bin/python
```

`scripts/deploy.sh` ships `scripts/a121_sidecar.py`; the venv lives outside
`~/SuperClock` and survives redeploys. `scripts/setup-pi.sh` provisions the
venv idempotently for a fresh Pi.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `RADAR_PYTHON` | Python interpreter for the sidecar (default `python3`; on the Pi, the exptool venv). |
| `RADAR_SIDECAR` | Path to `a121_sidecar.py` (default: `scripts/a121_sidecar.py` under the server's cwd). |
| `RADAR_PORT` | Serial device path (default `/dev/ttyACM0`). |
| `RADAR_MOCK` | `1` forces the mock driver; `0` forces the real sidecar. Default: mock in dev/test, real sidecar otherwise. |
| `RADAR_DEBUG` | `1` forwards the sidecar's stderr diagnostics to the server log. |
| `RADAR_DISABLED` | `1` disables the radar service entirely. |
