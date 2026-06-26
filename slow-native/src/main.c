/**
 * SuperClock-Slow — native LVGL kiosk for Pi Zero 2 W.
 *
 * Renders directly to /dev/dri/card1 via LVGL's Linux DRM driver, bypassing
 * Wayland/labwc entirely. This is the prototype — draws an analog clock.
 *
 * Build:   see CMakeLists.txt (build on the Pi: ~2 min for first build)
 * Run:     ./superclock_native              (uses /dev/dri/card1)
 *          ./superclock_native /dev/dri/card0
 *
 * To run as a kiosk: install scripts/superclock-native.service and disable
 * the desktop session — see README.md.
 */
#define _POSIX_C_SOURCE 200809L

#include "clock_face.h"
#include "weather_widget.h"
#include "lvgl.h"
#include "src/drivers/display/drm/lv_linux_drm.h"

#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

static volatile sig_atomic_t g_running = 1;

static void on_signal(int sig) {
    (void)sig;
    g_running = 0;
}

/* LVGL needs a millisecond tick. We compute it from CLOCK_MONOTONIC each
 * iteration of the main loop and call lv_tick_inc() with the delta. */
static uint32_t monotonic_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint32_t)(ts.tv_sec * 1000u + ts.tv_nsec / 1000000u);
}

int main(int argc, char **argv) {
    /* card0 on Pi Zero 2 W (no /dev/dri/card1, unlike Pi 5 where the HDMI
     * controller can show up as card1). Override via argv[1] if needed. */
    const char *card = (argc > 1) ? argv[1] : "/dev/dri/card0";

    signal(SIGINT,  on_signal);
    signal(SIGTERM, on_signal);

    lv_init();

    /* Create the DRM display. LVGL allocates two dumb buffers from the KMS
     * driver and flips between them. The display resolution is read from
     * the connected mode. */
    lv_display_t *disp = lv_linux_drm_create();
    lv_linux_drm_set_file(disp, card, -1);
    lv_display_set_default(disp);

    int32_t hres = lv_display_get_horizontal_resolution(disp);
    int32_t vres = lv_display_get_vertical_resolution(disp);
    fprintf(stderr, "[superclock] DRM display: %s @ %dx%d\n", card, hres, vres);

    /* Pi panel is square 1080×1080. Use the smaller side as our drawing
     * viewport so non-square displays don't distort the clock. */
    int32_t viewport = hres < vres ? hres : vres;

    clock_face_create(lv_screen_active(), viewport);
    weather_widget_create(lv_screen_active(), viewport);

    /* Main loop. lv_timer_handler() returns how many ms until the next
     * scheduled timer fires; we sleep that long, capped at 30 ms to keep
     * the second-hand smooth even when nothing else is pending. */
    uint32_t prev = monotonic_ms();
    while (g_running) {
        uint32_t now = monotonic_ms();
        lv_tick_inc(now - prev);
        prev = now;

        uint32_t next = lv_timer_handler();
        if (next > 50) next = 50;  /* cap — matches clock_face's 50 ms tick */
        if (next < 20) next = 20;  /* floor — don't spin when LVGL says "now" */
        struct timespec req = { .tv_sec = 0, .tv_nsec = next * 1000000L };
        nanosleep(&req, NULL);
    }

    fprintf(stderr, "[superclock] shutdown\n");
    lv_deinit();
    return 0;
}
