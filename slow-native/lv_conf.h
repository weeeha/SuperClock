/**
 * LVGL configuration for SuperClock-Slow (Pi Zero 2 W, 512 MB RAM, VC4).
 *
 * Tuned for direct-to-DRM rendering at 1080×1080. No GPU, no input device
 * yet (touch may be added later — the panel has USB touch).
 *
 * Only the keys we care about are listed here; everything else falls through
 * to LVGL's lv_conf_internal.h defaults via `#ifndef X #define X <default>`.
 */
#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

/* ---------------------------------------------------------------------------
 * Color & buffer
 * ------------------------------------------------------------------------- */
/* DRM dumb buffers on the Pi expose XRGB8888 by default — 32-bit color. */
#define LV_COLOR_DEPTH 32

/* Default screen size is set at runtime by the DRM driver; these are hints. */
#define LV_HOR_RES_MAX 1080
#define LV_VER_RES_MAX 1080

/* ---------------------------------------------------------------------------
 * Memory — LVGL's internal allocator. 1 MB is plenty for the analog clock;
 * leave headroom for adding more widgets later.
 * ------------------------------------------------------------------------- */
#define LV_USE_STDLIB_MALLOC LV_STDLIB_BUILTIN
#define LV_MEM_SIZE (1 * 1024 * 1024)

/* ---------------------------------------------------------------------------
 * Tick source — drive LV_TICK from clock_gettime(CLOCK_MONOTONIC) in main.c
 * so we don't need a separate timer thread.
 * ------------------------------------------------------------------------- */
#define LV_USE_OS LV_OS_NONE
#define LV_TICK_CUSTOM 0  /* we call lv_tick_inc() ourselves */

/* ---------------------------------------------------------------------------
 * Refresh — 50 ms (20 FPS). Matches the clock_face tick cadence — second
 * hand only moves once per 50 ms anyway, so faster refresh just burns CPU
 * checking for dirty regions on an A53 doing software rendering at 1080².
 * ------------------------------------------------------------------------- */
#define LV_DEF_REFR_PERIOD 50

/* ---------------------------------------------------------------------------
 * Logging — useful while iterating.
 * ------------------------------------------------------------------------- */
#define LV_USE_LOG 1
#define LV_LOG_LEVEL LV_LOG_LEVEL_WARN
#define LV_LOG_PRINTF 1

/* ---------------------------------------------------------------------------
 * Drivers — DRM direct (no Wayland/X11). Disables labwc requirement.
 * ------------------------------------------------------------------------- */
#define LV_USE_LINUX_DRM 1

/* ---------------------------------------------------------------------------
 * Widgets we actually use. Most others stay at default (which is "enabled
 * but not pulled in unless referenced", so unused ones don't cost much).
 * ------------------------------------------------------------------------- */
#define LV_USE_LABEL  1
#define LV_USE_LINE   1
#define LV_USE_ARC    1
#define LV_USE_OBJ    1

/* ---------------------------------------------------------------------------
 * Fonts — Montserrat 48 for any future digital readout. Default font 24.
 * ------------------------------------------------------------------------- */
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_MONTSERRAT_48 1
#define LV_FONT_DEFAULT &lv_font_montserrat_24

/* ---------------------------------------------------------------------------
 * Rendering — software only. LVGL's built-in SW renderer at 32 bpp.
 *
 * Explicitly set ASM=NONE. LVGL's default on unknown ARM targets pulls in the
 * Helium (Cortex-M vector) ASM path, which fails to assemble on Cortex-A53.
 * NEON would also work on aarch64 but ASM_NONE keeps the build portable;
 * pure C is fast enough for the clock at 1080×1080.
 * ------------------------------------------------------------------------- */
#define LV_USE_DRAW_SW 1
#define LV_DRAW_SW_COMPLEX 1
#define LV_DRAW_THREAD_STACK_SIZE (8 * 1024)

/* LV_DRAW_SW_ASM_* enum values are provided by lv_conf_internal.h; don't
 * redefine them here. Just set the selector to NONE. */
#define LV_DRAW_SW_ASM        LV_DRAW_SW_ASM_NONE

/* Enable Anti-Aliased line drawing — the clock hands need this. */
#define LV_USE_ANTIALIAS 1

#endif /* LV_CONF_H */
