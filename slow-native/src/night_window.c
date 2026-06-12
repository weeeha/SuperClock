#include "night_window.h"

/* Minute-of-day range: 00:00 .. 23:59. */
#define MINUTES_PER_DAY 1440

static inline bool valid_minute(int32_t m) {
    return m >= 0 && m < MINUTES_PER_DAY;
}

bool night_window_contains(int32_t start_min, int32_t end_min, int32_t cur_min) {
    if (!valid_minute(start_min) || !valid_minute(end_min) || !valid_minute(cur_min)) {
        return false;
    }
    if (start_min == end_min) {
        return false;
    }
    return start_min < end_min
               ? (cur_min >= start_min && cur_min < end_min)
               : (cur_min >= start_min || cur_min < end_min);
}
