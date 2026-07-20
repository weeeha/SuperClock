# A121 mmWave radar integration

SuperClock supports the Waveshare **A121 Range Sensor** (60 GHz pulsed
coherent radar, Acconeer A121 + STM32L431) for presence wake/sleep and the
Breathing app.

## Hardware

- Connect the module to the Pi over **USB-C**. Its CH342 chip enumerates as a
  plain serial port (`/dev/ttyACM*` / `/dev/ttyUSB*`, stable path under
  `/dev/serial/by-id/`), powered from the same cable. Default UART baud is
  **921600**.
- Field of view is 53°×65°; presence detection works to a few metres,
  breathing detection wants the subject within ~0.3–1.5 m. The sensor works
  through plastic, so it can sit behind the clock's bezel.

## Architecture

```
A121 module ──USB serial──► server/radar/driver.ts   (transport, reconnect)
                            server/radar/protocol.ts (line parser — see below)
                            server/radar/service.ts  (snapshot + mode lease)
                                 │                │
                    /api/radar/* routes    display-adapter (panel power)
                            │
        kiosk: src/core/radar.ts (SSE store) ─► PresenceShade, Breathing app
```

- `GET /api/radar` — current `RadarSnapshot` (`src/shared/radar.ts`).
- `GET /api/radar/stream` — SSE stream of snapshot updates.
- `POST /api/radar/mode {"mode":"breathing"|"presence"}` — the Breathing app
  leases breathing mode while active; the lease expires after 90 s without
  renewal and the sensor reverts to presence mode.
- `GET /api/occupancy` — desk-occupancy summary (`src/shared/occupancy.ts`)
  derived from presence transitions by `server/occupancy/service.ts`:
  today's at-desk total, per-hour buckets, and a 7-day history. Sessions
  persist to `config/occupancy.json` (gitignored, 30 days kept); dropouts
  shorter than 60 s merge into the surrounding session. Consumed by the
  Time Tracking app, which also auto-pauses its Pomodoro timer after 45 s
  of radar absence and auto-resumes on return.

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
- **Breathing app** — a new kiosk app showing live respiration rate.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `RADAR_PORT` | Serial device path (default: auto-detect). |
| `RADAR_BAUD` | Baud rate (default 921600). |
| `RADAR_MOCK` | `1` forces the mock driver; `0` forces real serial. Default: mock in `npm run dev`, serial otherwise. |
| `RADAR_DEBUG` | `1` logs every raw serial line. |
| `RADAR_DISABLED` | `1` disables the radar service entirely. |

## Protocol calibration (TODO — needs the physical sensor)

The exact UART register/frame format of the Waveshare firmware could not be
verified while this integration was written (the wiki was unreachable from
the dev environment). `server/radar/protocol.ts` therefore parses the demo
firmware's line output generously (text and JSON forms) and
`SerialRadarDriver.setMode` does not yet send a real mode-switch command.

To calibrate against the real module:

1. Plug the module into the Pi (or any Linux box) over USB-C.
2. Run `RADAR_DEBUG=1 npm run start` and capture ~1 minute of `[radar] <<`
   log lines while walking in/out of range (and breathing near it).
3. Tighten the patterns in `protocol.ts` — and implement `setMode` — to match
   the captured frames per the A121 Range Sensor wiki's register protocol.

Everything downstream of `protocol.ts` (service, API, kiosk UI, panel power)
is independent of the frame format and already works against the mock driver.
