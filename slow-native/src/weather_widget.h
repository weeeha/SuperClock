#ifndef SUPERCLOCK_WEATHER_WIDGET_H
#define SUPERCLOCK_WEATHER_WIDGET_H

#include "lvgl.h"

/**
 * Subtle temperature readout for the Minimalismo face.
 *
 * Creates a small label near the top of the screen ("65°F" style) and
 * spawns a background thread that refreshes the data every 10 min from
 * Open-Meteo. Initial state shows "—°F" until the first fetch lands.
 *
 * Coordinates and unit come from env vars (with SF defaults):
 *   WEATHER_LAT   — e.g. 37.7749
 *   WEATHER_LON   — e.g. -122.4194
 *   WEATHER_UNIT  — "fahrenheit" or "celsius"
 */
void weather_widget_create(lv_obj_t *parent, int32_t viewport_px);

#endif
