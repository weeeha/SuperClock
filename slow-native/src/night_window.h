#ifndef SUPERCLOCK_NIGHT_WINDOW_H
#define SUPERCLOCK_NIGHT_WINDOW_H

#include <stdbool.h>
#include <stdint.h>

/**
 * True when `cur_min` (minute of day, 0–1439) falls inside [start_min,
 * end_min), wrapping past midnight when start > end (e.g. 21:00 → 07:00).
 *
 * C port of the kiosk's shared helper — src/shared/time-window.ts
 * isWithinWindow() — keep the semantics in lockstep:
 *   - start == end                   → never active
 *   - start < end                    → cur >= start && cur < end
 *   - start > end (wraps midnight)   → cur >= start || cur < end
 *   - any argument outside [0, 1439] → false (mirrors "malformed HH:MM
 *     → never night")
 *
 * Pure and LVGL-free so it can be unit-tested on the host —
 * see tests/test_night_window.c.
 */
bool night_window_contains(int32_t start_min, int32_t end_min, int32_t cur_min);

#endif
