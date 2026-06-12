#ifndef SUPERCLOCK_HTTP_API_H
#define SUPERCLOCK_HTTP_API_H

#include <stdbool.h>

/**
 * Tiny HTTP/JSON client used by the LVGL kiosk. Single-shot blocking
 * fetches via libcurl; callers run these from a background thread to keep
 * the LVGL main loop responsive.
 */

typedef struct {
    double  temperature;   /* numeric, in `unit` passed to the fetch */
    int     weather_code;  /* WMO code 0-99; -1 if missing */
} weather_t;

/**
 * Hit Open-Meteo's /v1/forecast and fill `out` with current conditions.
 * `unit` is "fahrenheit" or "celsius". No API key required.
 * Returns true on success.
 */
bool http_get_weather(double lat, double lon, const char *unit, weather_t *out);

#endif
