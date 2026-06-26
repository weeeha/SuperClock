# slow-native — LVGL kiosk for SuperClock-Slow

Native C/LVGL renderer targeting **Pi Zero 2 W** (or any other Pi that's too
weak for the Chromium-based stack). Renders direct-to-DRM at the panel's
native resolution. No browser, no compositor, no JavaScript.

Same fleet, same Express server, different client.

## Why this exists

Pi Zero 2 W has 512 MB RAM (≈416 MB usable) and a VC4 GPU that only does
GLES 2.0. Chromium running our React+framer-motion dashboard at 1080×1080
either OOM-loops, never paints, or sits at 1–2 FPS. See
`memory/fleet.md` for the full diagnosis.

LVGL needs ~25 KB binary + ~1 MB working RAM, draws via the CPU (the four
A53 cores handle 1080×1080 / 60 FPS for the analog clock comfortably), and
talks straight to /dev/dri/card1.

## Status

**Prototype** — analog clock face only. Goals:

| Feature | Status |
|---|---|
| Boot direct to clock (no desktop) | ✅ designed (see `superclock-native.service`) |
| Analog clock face (Swiss railway) | ✅ matches `src/apps/clock/AnalogClock.tsx` |
| Smooth second-hand sweep | ✅ 50 ms timer + sub-second fraction |
| Scheduled night palette | ✅ compile-time 21:00 → 07:00 — see *Night mode* |
| Touch input (panel has USB touch) | ⏳ not wired |
| Weather / calendar / etc. from `/api/*` | ⏳ next step (libcurl + cJSON) |
| App switcher (gesture) | ⏳ later |

## Build & deploy (one-liner)

From the Mac, with `slowclock` SSH alias configured:

```sh
bash slow-native/scripts/deploy-from-mac.sh
```

This rsyncs the source to `~/SuperClock-native/slow-native/` on the Pi and
runs `setup-pi.sh`, which installs build deps, fetches LVGL, and compiles.
First build takes ~2 min on a Pi Zero 2 W.

## Run

Once built:

```sh
ssh slowclock '~/SuperClock-native/superclock_native'
```

…but only if labwc isn't holding `/dev/dri/card1`. To run as a real kiosk
(boot straight to the clock), follow the post-build instructions printed
by `setup-pi.sh` — short version:

```sh
ssh slowclock
sudo cp ~/SuperClock-native/slow-native/scripts/superclock-native.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo raspi-config nonint do_boot_behaviour B1   # console autologin
sudo systemctl enable --now superclock-native.service
sudo reboot
```

After this, the Pi boots straight into the clock — no labwc, no desktop.
SSH still works. To revert: `sudo raspi-config nonint do_boot_behaviour B4`.

## Night mode

Mirrors the kiosk's scheduled night mode
(`docs/superpowers/specs/2026-06-12-night-mode-design.md`): between
**21:00 and 07:00 local time** the dial inverts in place — black face,
white hour/minute hands, gold second hand unchanged.

- **Window semantics** are identical to `src/shared/time-window.ts`
  `isWithinWindow()`: minute-of-day comparison, `[start, end)`, midnight
  wrap, `start == end` → never night. The C port is
  `src/night_window.c` — if the TS helper ever changes, change both.
- **The schedule is compile-time** (`NIGHT_START_MIN` / `NIGHT_END_MIN` in
  `src/clock_face.c`). This device is read-only in admin v1 — no config
  push or polling — so it bakes the fleet's `settings.night` admin default.
  When the slow device grows config access, read the window from the fleet
  API instead.
- **Local time** comes from the Pi's timezone (`timedatectl`) — make sure
  it's set to the device's real location.
- **Testing without waiting for 21:00:** set `SUPERCLOCK_NIGHT=always` (or
  `never`) — e.g. in `/etc/superclock-native.env`, which the systemd unit
  loads — and restart. Unset it to return to the schedule.

The window predicate has a host-side unit test (no LVGL, runs on the Mac):

```sh
cd slow-native
cc -std=c11 -Wall -Wextra -Isrc -o /tmp/test_night_window \
   tests/test_night_window.c src/night_window.c && /tmp/test_night_window
```

## Source layout

```
slow-native/
├── CMakeLists.txt           # fetches LVGL v9.2.2 via FetchContent
├── lv_conf.h                # LVGL config — DRM driver, 32 bpp, 1 MB heap
├── src/
│   ├── main.c               # entry point, DRM setup, main loop
│   ├── clock_face.c         # analog clock widget (incl. night palette)
│   ├── clock_face.h
│   ├── night_window.c       # [start, end) wrap logic — port of time-window.ts
│   └── night_window.h
├── tests/
│   └── test_night_window.c  # host-side unit test (see "Night mode")
└── scripts/
    ├── setup-pi.sh                  # build on the Pi
    ├── deploy-from-mac.sh           # rsync + remote build
    └── superclock-native.service    # systemd unit (boots into clock)
```

## Architecture notes

- **DRM direct, not Wayland.** The kiosk binary opens `/dev/dri/card1` and
  drives it via KMS dumb buffers. This means labwc must not be running
  (the unit file conflicts with `graphical.target` for this reason).
  Pi-OS booted to console autologin (`B1`) is the supported config.
- **No GPU acceleration.** LVGL's software renderer at 32 bpp on the A53
  cores is fast enough. The VC4 doesn't help us anyway (GLES 2.0 only).
- **Express server stays on the Pi.** The systemd `superclock.service`
  (the Node Express server) keeps running so future iterations can fetch
  `/api/calendar`, `/api/photos`, etc. via libcurl from the native binary.

## Next steps

1. Verify the clock renders at the expected FPS on real hardware. Target:
   60 Hz at 1080×1080, < 5% CPU per core.
2. Wire USB touch input (`lv_indev` with libinput backend).
3. Add a screen-rotation widget that switches between clock face and a few
   data widgets — start with weather (Open-Meteo is a tiny JSON endpoint).
4. Decide whether to vendor LVGL as a git submodule instead of FetchContent
   (offline-friendlier, costs ~10 MB in the repo).
