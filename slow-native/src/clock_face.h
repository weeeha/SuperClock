#ifndef SUPERCLOCK_CLOCK_FACE_H
#define SUPERCLOCK_CLOCK_FACE_H

#include "lvgl.h"

/**
 * Build the Swiss-railway analog clock face on `parent` and start a timer
 * that animates the hands. Visually matches src/apps/clock/AnalogClock.tsx
 * from the React app (Figma node 489:21023).
 *
 * `viewport_px` is the side length of the square render target (1080 on the
 * Pi panel). The face fills the viewport.
 */
void clock_face_create(lv_obj_t *parent, int32_t viewport_px);

#endif
