#define _POSIX_C_SOURCE 200809L
#include "http_api.h"
#include <curl/curl.h>
#include <cjson/cJSON.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char  *data;
    size_t size;
} response_t;

static size_t write_cb(void *contents, size_t size, size_t nmemb, void *userp) {
    response_t *r = (response_t *)userp;
    size_t total = size * nmemb;
    char *p = realloc(r->data, r->size + total + 1);
    if (!p) return 0;  /* libcurl will abort the transfer */
    r->data = p;
    memcpy(r->data + r->size, contents, total);
    r->size += total;
    r->data[r->size] = '\0';
    return total;
}

bool http_get_weather(double lat, double lon, const char *unit, weather_t *out) {
    if (!out || !unit) return false;

    char url[320];
    snprintf(url, sizeof(url),
        "https://api.open-meteo.com/v1/forecast"
        "?latitude=%.4f&longitude=%.4f"
        "&current=temperature_2m,weather_code"
        "&temperature_unit=%s",
        lat, lon, unit);

    CURL *curl = curl_easy_init();
    if (!curl) return false;

    response_t r = { .data = NULL, .size = 0 };
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &r);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "SuperClock-Slow/1.0");

    CURLcode rc = curl_easy_perform(curl);
    long http_status = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_status);
    curl_easy_cleanup(curl);

    if (rc != CURLE_OK || http_status != 200 || !r.data) {
        fprintf(stderr, "[http_api] weather fetch failed: curl=%d http=%ld\n",
                rc, http_status);
        free(r.data);
        return false;
    }

    bool ok = false;
    cJSON *root = cJSON_Parse(r.data);
    if (root) {
        cJSON *current = cJSON_GetObjectItem(root, "current");
        if (current) {
            cJSON *temp = cJSON_GetObjectItem(current, "temperature_2m");
            cJSON *code = cJSON_GetObjectItem(current, "weather_code");
            if (cJSON_IsNumber(temp)) {
                out->temperature  = temp->valuedouble;
                out->weather_code = cJSON_IsNumber(code) ? code->valueint : -1;
                ok = true;
            }
        }
        cJSON_Delete(root);
    } else {
        fprintf(stderr, "[http_api] JSON parse failed: %s\n",
                cJSON_GetErrorPtr() ? cJSON_GetErrorPtr() : "?");
    }
    free(r.data);
    return ok;
}
