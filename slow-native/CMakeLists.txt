cmake_minimum_required(VERSION 3.16)
project(superclock_native C)

# -----------------------------------------------------------------------------
# Build the native (LVGL-based) SuperClock client for low-RAM Raspberry Pis.
#
# Targets: Pi Zero 2 W (4×A53 @ 1 GHz, 512 MB RAM, VideoCore IV) running
# Raspberry Pi OS Trixie aarch64.
#
# Renders direct-to-DRM (KMS, no compositor) at the panel's native resolution.
# No GPU acceleration required — software rendering on the A53 cores is plenty
# for the analog clock face at 1080×1080 / 60 FPS.
# -----------------------------------------------------------------------------

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)  # need _POSIX_C_SOURCE etc.

# Build type — Release by default for performance on the Pi.
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()
add_compile_options(-Wall -Wextra -Wno-unused-parameter)

# -----------------------------------------------------------------------------
# System libs:
#   libdrm   — needed by our executable AND by LVGL's built-in DRM driver
#              (which globs lv_linux_drm.c into the lvgl target).
#   libcurl  — HTTPS for the weather fetch.
#   libcjson — JSON parsing for Open-Meteo's response.
#   threads  — pthread for the background fetch worker.
# -----------------------------------------------------------------------------
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBDRM   REQUIRED libdrm)
pkg_check_modules(LIBCURL  REQUIRED libcurl)
pkg_check_modules(LIBCJSON REQUIRED libcjson)
find_package(Threads REQUIRED)

# -----------------------------------------------------------------------------
# LVGL — fetched at configure time. v9.2.2 is the latest stable as of the
# initial commit. Pinning to a tag so reproducible.
# -----------------------------------------------------------------------------
include(FetchContent)
FetchContent_Declare(
  lvgl
  GIT_REPOSITORY https://github.com/lvgl/lvgl.git
  GIT_TAG        v9.2.2
  GIT_SHALLOW    TRUE
)
# Point LVGL at our lv_conf.h — must be set before MakeAvailable.
set(LV_CONF_PATH "${CMAKE_SOURCE_DIR}/lv_conf.h" CACHE FILEPATH "" FORCE)
set(LV_CONF_BUILD_DISABLE_EXAMPLES ON CACHE BOOL "" FORCE)
set(LV_CONF_BUILD_DISABLE_DEMOS    ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(lvgl)

# LVGL's CMake globs every .c/.S under src/ into the lvgl target. The two .S
# files (helium for Cortex-M MVE, neon for ARMv7) are gated at the C-preproc
# level on LV_USE_DRAW_SW_ASM, but they still try to assemble headers that
# pull in <stdint.h>, which the GAS assembler can't parse. We don't need
# either ASM path on aarch64 — strip them from the source list so the build
# uses pure C blend routines instead.
get_target_property(_lvgl_sources lvgl SOURCES)
list(FILTER _lvgl_sources EXCLUDE REGEX "lv_blend_(helium|neon)\\.S$")
set_property(TARGET lvgl PROPERTY SOURCES ${_lvgl_sources})

# LVGL's built-in DRM driver (src/drivers/display/drm/lv_linux_drm.c) includes
# <xf86drm.h> which on Debian/Pi-OS lives under /usr/include/libdrm/. LVGL's
# CMake doesn't know to add that — pull it onto the lvgl target itself.
target_include_directories(lvgl SYSTEM PRIVATE ${LIBDRM_INCLUDE_DIRS})
target_link_libraries(lvgl PRIVATE ${LIBDRM_LIBRARIES})

# -----------------------------------------------------------------------------
# Target
# -----------------------------------------------------------------------------
add_executable(superclock_native
  src/main.c
  src/clock_face.c
  src/night_window.c
  src/http_api.c
  src/weather_widget.c
)
target_include_directories(superclock_native PRIVATE
  ${CMAKE_SOURCE_DIR}
  ${CMAKE_SOURCE_DIR}/src
  ${LIBDRM_INCLUDE_DIRS}
  ${LIBCURL_INCLUDE_DIRS}
  ${LIBCJSON_INCLUDE_DIRS}
)
target_link_libraries(superclock_native PRIVATE
  lvgl
  m                      # libm for trig
  ${LIBDRM_LIBRARIES}
  ${LIBCURL_LIBRARIES}
  ${LIBCJSON_LIBRARIES}
  Threads::Threads
)
target_compile_options(superclock_native PRIVATE
  ${LIBDRM_CFLAGS_OTHER}
  ${LIBCURL_CFLAGS_OTHER}
  ${LIBCJSON_CFLAGS_OTHER}
)

install(TARGETS superclock_native RUNTIME DESTINATION bin)
