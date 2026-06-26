#define _POSIX_C_SOURCE 200809L
#include "clock_face.h"
#include <math.h>
#include <stdlib.h>
#include <time.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* -------------------------------------------------------------------------
 * Geometry — proportional to viewport size so we can resize later.
 *
 * Reference: src/apps/clock/AnalogClock.tsx uses a 1000-unit SVG viewBox.
 * Scale factor is viewport_px / 1000.
 *
 *   face radius        460  (R)
 *   hour tick outer    60   (from edge)
 *   minute tick outer  20
 *   hour hand length   280  (from center to tip, viewBox y 220 → 500 → 280)
 *   minute hand length 380
 *   second hand        from y=580 to y=150 → 80 back + 350 forward
 * ------------------------------------------------------------------------- */

typedef struct {
    int32_t center;
    int32_t face_r;
    /* hand lengths */
    int32_t hour_fwd;
    int32_t min_fwd;
    int32_t sec_back;
    int32_t sec_fwd;
    /* line widths */
    int32_t hour_w;
    int32_t min_w;
    int32_t sec_w;
    /* tick geometry */
    int32_t hour_tick_inner;
    int32_t hour_tick_outer;
    int32_t min_tick_inner;
    int32_t min_tick_outer;
    int32_t hour_tick_w;
    int32_t min_tick_w;
    /* dot sizes */
    int32_t dot_outer;
    int32_t dot_inner;
} geom_t;

typedef struct {
    geom_t g;
    lv_obj_t *hour;
    lv_obj_t *min;
    lv_obj_t *sec;
    lv_point_precise_t hour_pts[2];
    lv_point_precise_t min_pts[2];
    lv_point_precise_t sec_pts[2];
} clock_state_t;

/* Swiss railway gold for the second hand and center pip. */
#define COLOR_GOLD lv_color_hex(0xFFD700)

/* Convert a clock angle (0° = 12 o'clock, clockwise) to LVGL screen radians.
 * LVGL +x is right, +y is down — same as SVG. */
static inline double clock_angle_to_rad(double deg) {
    return (deg - 90.0) * (M_PI / 180.0);
}

/* Update a line widget's two endpoints to draw a hand from `back` units
 * behind the center to `fwd` units in front, at `deg` degrees from 12. */
static void set_hand(lv_obj_t *line, lv_point_precise_t *pts,
                     int32_t center, int32_t back, int32_t fwd, double deg) {
    double rad  = clock_angle_to_rad(deg);
    double cosa = cos(rad);
    double sina = sin(rad);
    pts[0].x = center - (lv_value_precise_t)(back * cosa);
    pts[0].y = center - (lv_value_precise_t)(back * sina);
    pts[1].x = center + (lv_value_precise_t)(fwd  * cosa);
    pts[1].y = center + (lv_value_precise_t)(fwd  * sina);
    lv_line_set_points(line, pts, 2);
}

static void tick_cb(lv_timer_t *t) {
    clock_state_t *s = (clock_state_t *)lv_timer_get_user_data(t);

    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    struct tm tm;
    localtime_r(&ts.tv_sec, &tm);

    /* Sub-second fraction lets the second hand sweep instead of ticking. */
    double sec       = tm.tm_sec + ts.tv_nsec / 1.0e9;
    double min_total = tm.tm_min + sec / 60.0;
    double hr_total  = (tm.tm_hour % 12) + min_total / 60.0;

    set_hand(s->hour, s->hour_pts, s->g.center, 0, s->g.hour_fwd, hr_total  * 30.0);
    set_hand(s->min,  s->min_pts,  s->g.center, 0, s->g.min_fwd,  min_total *  6.0);
    set_hand(s->sec,  s->sec_pts,  s->g.center, s->g.sec_back, s->g.sec_fwd, sec * 6.0);
}

static lv_obj_t *make_dot(lv_obj_t *parent, int32_t center, int32_t size, lv_color_t color) {
    lv_obj_t *d = lv_obj_create(parent);
    lv_obj_set_size(d, size, size);
    lv_obj_set_pos(d, center - size / 2, center - size / 2);
    lv_obj_set_style_radius(d, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(d, color, 0);
    lv_obj_set_style_bg_opa(d, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(d, 0, 0);
    lv_obj_set_style_pad_all(d, 0, 0);
    lv_obj_remove_flag(d, LV_OBJ_FLAG_SCROLLABLE);
    return d;
}

static lv_obj_t *make_hand(lv_obj_t *parent, lv_color_t color, int32_t width) {
    lv_obj_t *h = lv_line_create(parent);
    lv_obj_set_style_line_color(h, color, 0);
    lv_obj_set_style_line_width(h, width, 0);
    lv_obj_set_style_line_rounded(h, true, 0);
    return h;
}

static geom_t scale_geom(int32_t viewport_px) {
    /* Reference geometry assumes a 1000-unit viewBox (AnalogClock.tsx). */
    double s = viewport_px / 1000.0;
    geom_t g = {
        .center           = viewport_px / 2,
        .face_r           = (int32_t)(460 * s),
        .hour_fwd         = (int32_t)(280 * s),
        .min_fwd          = (int32_t)(380 * s),
        .sec_back         = (int32_t)( 80 * s),
        .sec_fwd          = (int32_t)(350 * s),
        .hour_w           = (int32_t)( 28 * s),
        .min_w            = (int32_t)( 20 * s),
        .sec_w            = (int32_t)(  6 * s),
        .hour_tick_outer  = (int32_t)(440 * s),  /* (R - 20 in SVG → 1000-y=940 maps to r=440) */
        .hour_tick_inner  = (int32_t)(380 * s),
        .min_tick_outer   = (int32_t)(420 * s),
        .min_tick_inner   = (int32_t)(395 * s),
        .hour_tick_w      = (int32_t)( 12 * s),
        .min_tick_w       = (int32_t)(  4 * s),
        .dot_outer        = (int32_t)( 24 * s),
        .dot_inner        = (int32_t)( 12 * s),
    };
    return g;
}

void clock_face_create(lv_obj_t *parent, int32_t viewport_px) {
    clock_state_t *s = (clock_state_t *)lv_malloc(sizeof(clock_state_t));
    LV_ASSERT_MALLOC(s);
    s->g = scale_geom(viewport_px);

    /* Black backdrop — the whole screen. */
    lv_obj_set_style_bg_color(parent, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(parent, LV_OPA_COVER, 0);
    lv_obj_remove_flag(parent, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_pad_all(parent, 0, 0);

    /* White circular face. */
    lv_obj_t *face = lv_obj_create(parent);
    lv_obj_set_size(face, s->g.face_r * 2, s->g.face_r * 2);
    lv_obj_set_pos(face, s->g.center - s->g.face_r, s->g.center - s->g.face_r);
    lv_obj_set_style_bg_color(face, lv_color_white(), 0);
    lv_obj_set_style_bg_opa(face, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(face, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(face, 0, 0);
    lv_obj_set_style_pad_all(face, 0, 0);
    lv_obj_remove_flag(face, LV_OBJ_FLAG_SCROLLABLE);

    /* 60 tick marks. Drawn on the parent so we can use absolute coordinates;
     * face would force us to subtract its top-left every time. */
    for (int i = 0; i < 60; i++) {
        bool is_hour = (i % 5 == 0);
        double rad = clock_angle_to_rad(i * 6.0);
        double cosa = cos(rad), sina = sin(rad);
        int32_t inner = is_hour ? s->g.hour_tick_inner : s->g.min_tick_inner;
        int32_t outer = is_hour ? s->g.hour_tick_outer : s->g.min_tick_outer;
        lv_point_precise_t pts[2] = {
            {s->g.center + (lv_value_precise_t)(outer * cosa),
             s->g.center + (lv_value_precise_t)(outer * sina)},
            {s->g.center + (lv_value_precise_t)(inner * cosa),
             s->g.center + (lv_value_precise_t)(inner * sina)},
        };
        lv_obj_t *tick = lv_line_create(parent);
        lv_line_set_points(tick, pts, 2);
        lv_obj_set_style_line_color(tick, lv_color_black(), 0);
        lv_obj_set_style_line_width(tick, is_hour ? s->g.hour_tick_w : s->g.min_tick_w, 0);
        lv_obj_set_style_line_rounded(tick, true, 0);
    }

    /* Hands. Order matters — second hand on top. */
    s->hour = make_hand(parent, lv_color_black(), s->g.hour_w);
    s->min  = make_hand(parent, lv_color_black(), s->g.min_w);
    s->sec  = make_hand(parent, COLOR_GOLD,       s->g.sec_w);

    /* Center pip — gold outer, black inner. */
    make_dot(parent, s->g.center, s->g.dot_outer, COLOR_GOLD);
    make_dot(parent, s->g.center, s->g.dot_inner, lv_color_black());

    /* 50 ms timer (20 Hz) — still reads as smooth for the second-hand sweep
     * but ~40 % less work than the earlier 30 ms. On Pi Zero 2 W this drops
     * the kiosk from ~95 % of one A53 core to ~55 %. LVGL only invalidates
     * each hand's bounding box per redraw, so the actual rasterisation is
     * cheap; bottleneck is the dirty-area scan loop. */
    lv_timer_t *timer = lv_timer_create(tick_cb, 50, s);
    tick_cb(timer);
}
