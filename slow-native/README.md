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
| Smooth second-hand sweep | ✅ 30 ms timer + sub-second fraction |
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

## Source layout

```
slow-native/
├── CMakeLists.txt           # fetches LVGL v9.2.2 via FetchContent
├── lv_conf.h                # LVGL config — DRM driver, 32 bpp, 1 MB heap
├── src/
│   ├── main.c               # entry point, DRM setup, main loop
│   ├── clock_face.c         # analog clock widget
│   └── clock_face.h
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
