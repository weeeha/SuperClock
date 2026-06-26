/**
 * Host-side unit test for night_window_contains() — no LVGL, no Pi needed.
 *
 * Run from slow-native/:
 *   cc -std=c11 -Wall -Wextra -Isrc -o /tmp/test_night_window \
 *      tests/test_night_window.c src/night_window.c && /tmp/test_night_window
 *
 * The cases mirror src/shared/time-window.ts isWithinWindow() — if that
 * helper's semantics ever change, change these together.
 */
#include "night_window.h"

#include <stdio.h>

static int g_failures = 0;

#define MIN(h, m) ((h) * 60 + (m))

static void check(bool got, bool want, const char *desc) {
    if (got != want) {
        g_failures++;
        fprintf(stderr, "FAIL: %s — got %s, want %s\n",
                desc, got ? "true" : "false", want ? "true" : "false");
    }
}

int main(void) {
    /* Wrapping window — the fleet default 21:00 → 07:00. */
    int32_t ws = MIN(21, 0), we = MIN(7, 0);
    check(night_window_contains(ws, we, MIN(20, 59)), false, "wrap: 20:59 is day");
    check(night_window_contains(ws, we, MIN(21, 0)),  true,  "wrap: 21:00 starts night (inclusive)");
    check(night_window_contains(ws, we, MIN(23, 59)), true,  "wrap: 23:59 is night");
    check(night_window_contains(ws, we, MIN(0, 0)),   true,  "wrap: 00:00 is night");
    check(night_window_contains(ws, we, MIN(3, 30)),  true,  "wrap: 03:30 is night");
    check(night_window_contains(ws, we, MIN(6, 59)),  true,  "wrap: 06:59 is night");
    check(night_window_contains(ws, we, MIN(7, 0)),   false, "wrap: 07:00 ends night (exclusive)");
    check(night_window_contains(ws, we, MIN(12, 0)),  false, "wrap: noon is day");

    /* Same-day window. */
    int32_t ds = MIN(9, 0), de = MIN(17, 0);
    check(night_window_contains(ds, de, MIN(8, 59)),  false, "same-day: 08:59 outside");
    check(night_window_contains(ds, de, MIN(9, 0)),   true,  "same-day: 09:00 inside (inclusive)");
    check(night_window_contains(ds, de, MIN(16, 59)), true,  "same-day: 16:59 inside");
    check(night_window_contains(ds, de, MIN(17, 0)),  false, "same-day: 17:00 outside (exclusive)");
    check(night_window_contains(ds, de, MIN(0, 0)),   false, "same-day: midnight outside");

    /* start == end → never active (mirrors sleep-schedule behavior). */
    check(night_window_contains(MIN(9, 0), MIN(9, 0), MIN(9, 0)),  false, "empty: cur == start == end");
    check(night_window_contains(MIN(9, 0), MIN(9, 0), MIN(12, 0)), false, "empty: cur elsewhere");

    /* Nearly-full-day window 00:00 → 23:59. */
    check(night_window_contains(0, 1439, 0),    true,  "full-day: 00:00 inside");
    check(night_window_contains(0, 1439, 1438), true,  "full-day: 23:58 inside");
    check(night_window_contains(0, 1439, 1439), false, "full-day: 23:59 outside (exclusive)");

    /* One-minute wrap window 23:59 → 00:00. */
    check(night_window_contains(1439, 0, 1439), true,  "minute-wrap: 23:59 inside");
    check(night_window_contains(1439, 0, 0),    false, "minute-wrap: 00:00 outside");

    /* Out-of-range arguments → false (mirrors "malformed HH:MM" → never). */
    check(night_window_contains(-1, 420, 0),     false, "invalid: negative start");
    check(night_window_contains(1260, 1440, 0),  false, "invalid: end past 23:59");
    check(night_window_contains(1260, 420, -5),  false, "invalid: negative cur");
    check(night_window_contains(1260, 420, 1440), false, "invalid: cur past 23:59");

    if (g_failures) {
        fprintf(stderr, "%d failure(s)\n", g_failures);
        return 1;
    }
    printf("test_night_window: all checks passed\n");
    return 0;
}
