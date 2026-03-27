#include "camera.h"
#include "config.h"

// Note: This implementation requires the ESP32-Camera library
// If using OV2640 or OV5640 sensor via parallel interface

#if ENABLE_CAMERA
#include "esp_camera.h"
#endif

CameraModule::CameraModule() : camera_ready(false), frame_count(0) {
}

bool CameraModule::begin() {
    LOG_INFO("Initializing camera module...");

#if ENABLE_CAMERA
    if (!initializeCamera()) {
        LOG_ERROR("Camera initialization failed");
        return false;
    }

    if (!configureCamera()) {
        LOG_ERROR("Camera configuration failed");
        return false;
    }

    camera_ready = true;
    LOG_INFO("Camera initialized successfully");
    return true;
#else
    LOG_INFO("Camera disabled in config");
    return false;
#endif
}

bool CameraModule::end() {
    // Release camera resources
    camera_ready = false;
    return true;
}

#if ENABLE_CAMERA

bool CameraModule::initializeCamera() {
    // Camera configuration for OV2640 or similar
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0       = CAM_PIN_Y2;
    config.pin_d1       = CAM_PIN_Y3;
    config.pin_d2       = CAM_PIN_Y4;
    config.pin_d3       = CAM_PIN_Y5;
    config.pin_d4       = CAM_PIN_Y6;
    config.pin_d5       = CAM_PIN_Y7;
    config.pin_d6       = CAM_PIN_Y8;
    config.pin_d7       = CAM_PIN_Y9;
    config.pin_xclk     = CAMERA_XCLK;
    config.pin_pclk     = CAMERA_PCLK;
    config.pin_vsync    = CAMERA_VSYNC;
    config.pin_href     = CAMERA_HREF;
    config.pin_sccb_sda = CAMERA_SIOD;
    config.pin_sccb_scl = CAMERA_SIOC;
    config.pin_pwdn     = CAMERA_PWDN;
    config.pin_reset    = CAMERA_RESET;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size   = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 10;  // 10-63, lower is better quality
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    if (psramFound()) {
    LOG_INFO("PSRAM found — using 2 frame buffers.");
    config.fb_count  = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      LOG_INFO("No PSRAM — falling back to DRAM, limiting to SVGA.");
      config.fb_location = CAMERA_FB_IN_DRAM;
      if (config.frame_size > FRAMESIZE_SVGA) {
        config.frame_size = FRAMESIZE_SVGA;
      }
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        LOG_ERROR("Camera init failed with error 0x%x", err);
        return false;
    }

    return true;
}

bool CameraModule::configureCamera() {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) {
        LOG_ERROR("Failed to get camera sensor");
        return false;
    }

    // Configure sensor
    s->set_brightness(s, 0);     // -2 to 2
    s->set_contrast(s, 0);       // -2 to 2
    s->set_saturation(s, 0);     // -2 to 2
    s->set_special_effect(s, 0); // 0 to 6 (no effect, negative, grayscale, red tint, etc)
    s->set_whitebal(s, 1);       // Enable auto white balance
    s->set_awb_gain(s, 1);       // Auto white balance gain
    s->set_wb_mode(s, 0);        // 0 to 4 (auto, sunny, cloudy, office, home)
    s->set_exposure_ctrl(s, 1);  // Auto exposure
    s->set_aec_value(s, 300);    // AEC value (0 to 1200)
    s->set_gain_ctrl(s, 1);      // Auto gain
    s->set_agc_gain(s, 0);       // AGC gain (0 to 30)
    s->set_gainceiling(s, (gainceiling_t)0);  // Gain ceiling
    s->set_bpc(s, 0);            // Black pixel correction
    s->set_wpc(s, 1);            // White pixel correction
    s->set_raw_gma(s, 1);        // Raw gamma
    s->set_lenc(s, 1);           // Lens correction
    s->set_hmirror(s, 0);        // Horizontal mirror
    s->set_vflip(s, 0);          // Vertical flip
    s->set_dcw(s, 1);            // Downsize camera width
    s->set_colorbar(s, 0);       // Color bar (for testing)

    return true;
}

#else

bool CameraModule::initializeCamera() {
    return false;
}

bool CameraModule::configureCamera() {
    return false;
}

#endif

bool CameraModule::captureJPEG(FrameBuffer& fb) {
    if (!camera_ready) {
        LOG_ERROR("Camera not ready");
        return false;
    }

#if ENABLE_CAMERA
    camera_fb_t* pic = esp_camera_fb_get();

    if (!pic) {
        LOG_ERROR("Failed to capture frame");
        return false;
    }

    fb.buffer = pic->buf;
    fb.length = pic->len;
    fb.timestamp = millis();
    frame_count++;

    LOG_INFO("Captured JPEG frame: %d bytes", fb.length);
    return true;
#else
    return false;
#endif
}

bool CameraModule::captureRaw(FrameBuffer& fb) {
    // RAW capture would require different pixel format
    // For simplicity, this can be left unimplemented or use PIXFORMAT_RGB565
    return false;
}

void CameraModule::releaseFrameBuffer(FrameBuffer& fb) {
#if ENABLE_CAMERA
    if (fb.buffer) {
        camera_fb_t pic;
        pic.buf = fb.buffer;
        esp_camera_fb_return((camera_fb_t*)&pic);
        fb.buffer = nullptr;
        fb.length = 0;
    }
#endif
}

bool CameraModule::setResolution(uint16_t width, uint16_t height) {
    // Frame size can be set via sensor config
    // Not implemented for simplicity
    return true;
}

bool CameraModule::setQuality(uint8_t quality) {
    if (!camera_ready) return false;
    // JPEG quality (10-63)
    quality = constrain(quality, 10, 63);
    // Can be set via sensor config
    return true;
}

bool CameraModule::setFrameRate(uint8_t fps) {
    // Can be configured via sensor settings
    return true;
}

bool CameraModule::isReady() {
    return camera_ready;
}

uint32_t CameraModule::getFrameCount() {
    return frame_count;
}
