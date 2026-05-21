#define _POSIX_C_SOURCE 200809L
#include "weather_widget.h"
#include "http_api.h"
#include "lvgl.h"

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

/* ---------------------------------------------------------------------------
 * Threading model:
 *   - A background pthread does the (blocking) HTTPS fetch every 10 minutes
 *     and writes the latest reading into shared state under a mutex.
 *   - An LVGL timer on the main thread polls the shared state once a second
 *     and updates the label when the dirty flag is set. Keeps LVGL on a
 *     single thread, which is the only place it's safe to touch widgets
 *     when LV_USE_OS == LV_OS_NONE.
 * ------------------------------------------------------------------------- */

#define DEFAULT_LAT  37.7749    /* San Francisco — override via WEATHER_LAT */
#define DEFAULT_LON -122.4194
#define DEFAULT_UNIT "fahrenheit"
#define REFRESH_SEC  600        /* 10 min */
#define RETRY_SEC     60        /* on failure */

static struct {
    pthread_mutex_t mu;
    weather_t       latest;
    bool            has_data;
    bool            dirty;
    char            unit_suffix[4];  /* "°F" or "°C" in UTF-8, plus NUL */
} g_state = {
    .mu       = PTHREAD_MUTEX_INITIALIZER,
    .has_data = false,
    .dirty    = false,
};

static lv_obj_t *g_label;

static double env_double(const char *name, double fallback) {
    const char *v = getenv(name);
    return (v && *v) ? atof(v) : fallback;
}

static const char *env_str(const char *name, const char *fallback) {
    const char *v = getenv(name);
    return (v && *v) ? v : fallback;
}

static void *worker(void *arg) {
    (void)arg;
    double      lat  = env_double("WEATHER_LAT", DEFAULT_LAT);
    double      lon  = env_double("WEATHER_LON", DEFAULT_LON);
    const char *unit = env_str   ("WEATHER_UNIT", DEFAULT_UNIT);

    /* Pre-compute the suffix once. UTF-8: ° is 0xC2 0xB0. */
    const char *suffix = (strcmp(unit, "celsius") == 0) ? "\xC2\xB0""C" : "\xC2\xB0""F";
    pthread_mutex_lock(&g_state.mu);
    strncpy(g_state.unit_suffix, suffix, sizeof(g_state.unit_suffix) - 1);
    pthread_mutex_unlock(&g_state.mu);

    for (;;) {
        weather_t w;
        bool ok = http_get_weather(lat, lon, unit, &w);
        if (ok) {
            pthread_mutex_lock(&g_state.mu);
            g_state.latest   = w;
            g_state.has_data = true;
            g_state.dirty    = true;
            pthread_mutex_unlock(&g_state.mu);
        }
        sleep(ok ? REFRESH_SEC : RETRY_SEC);
    }
    return NULL;
}

static void ui_poll(lv_timer_t *t) {
    (void)t;
    pthread_mutex_lock(&g_state.mu);
    if (!g_state.dirty) {
        pthread_mutex_unlock(&g_state.mu);
        return;
    }
    g_state.dirty = false;
    char buf[16];
    snprintf(buf, sizeof(buf), "%.0f%s",
             g_state.latest.temperature, g_state.unit_suffix);
    pthread_mutex_unlock(&g_state.mu);

    lv_label_set_text(g_label, buf);
}

void weather_widget_create(lv_obj_t *parent, int32_t viewport_px) {
    g_label = lv_label_create(parent);
    lv_label_set_text(g_label, "...");  /* placeholder until first fetch */
    lv_obj_set_style_text_color(g_label, lv_color_hex(0x888888), 0);
    lv_obj_set_style_text_font (g_label, &lv_font_montserrat_24, 0);
    /* Position at top of viewport, ~1/6 down from the edge — sits in the
     * dead space above the 12 o'clock area without crowding the hour hand. */
    lv_obj_align(g_label, LV_ALIGN_TOP_MID, 0, viewport_px / 6);

    /* UI polls every second — cheap because nothing happens unless dirty. */
    lv_timer_create(ui_poll, 1000, NULL);

    /* Spawn the fetch thread. Detached — we never join. */
    pthread_t tid;
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    pthread_attr_setstacksize(&attr, 128 * 1024);  /* curl needs ~64 KB */
    pthread_create(&tid, &attr, worker, NULL);
    pthread_attr_destroy(&attr);
}
