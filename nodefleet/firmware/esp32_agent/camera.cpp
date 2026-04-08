#include "camera.h"
#include "config.h"
#include <SD_MMC.h>
// Note: This implementation requires the ESP32-Camera library
// If using OV2640 or OV5640 sensor via parallel interface


#include "esp_camera.h"


// AVI writer state
static File aviFile;
uint32_t aviFrameCount = 0;
static uint32_t aviTotalSize = 0;
static uint16_t aviWidth = 640;
static uint16_t aviHeight = 480;

void getResolutionDimensions(framesize_t fs, uint16_t &w, uint16_t &h) {
  switch (fs) {
    case FRAMESIZE_QQVGA: w = 160;  h = 120; break;
    case FRAMESIZE_QVGA:  w = 320;  h = 240; break;
    case FRAMESIZE_CIF:   w = 400;  h = 296; break;
    case FRAMESIZE_VGA:   w = 640;  h = 480; break;
    case FRAMESIZE_SVGA:  w = 800;  h = 600; break;
    case FRAMESIZE_XGA:   w = 1024; h = 768; break;
    default:              w = 640;  h = 480; break;
  }
}

// ============================================================
// AVI-MJPEG Writer
// ============================================================

static void aviWriteU32(uint32_t val) {
  uint8_t buf[4] = {
    (uint8_t)(val & 0xFF),
    (uint8_t)((val >> 8) & 0xFF),
    (uint8_t)((val >> 16) & 0xFF),
    (uint8_t)((val >> 24) & 0xFF)
  };
  aviFile.write(buf, 4);
}

static void aviWriteU16(uint16_t val) {
  uint8_t buf[2] = {
    (uint8_t)(val & 0xFF),
    (uint8_t)((val >> 8) & 0xFF)
  };
  aviFile.write(buf, 2);
}

static void aviWriteFourCC(const char* tag) {
  aviFile.write((const uint8_t*)tag, 4);
}

static bool aviStart(fs::FS &fs, const char* filename) {
  LOG_INFO("Open file %s",filename);
  aviFile = fs.open(filename, FILE_WRITE);
  if (!aviFile) {
    LOG_ERROR("Failed to create AVI: ");
    LOG_ERROR("%s",filename);
    return false;
  }

  aviFrameCount = 0;
  aviTotalSize = 0;
  getResolutionDimensions(FRAMESIZE_VGA, aviWidth, aviHeight);

  // Write 512-byte placeholder header (will be overwritten in finalize)
  uint8_t zeros[512];
  memset(zeros, 0, 512);
  aviFile.write(zeros, 512);

  return true;
}

static void aviWriteFrame(const uint8_t* jpegData, size_t len) {
  aviWriteFourCC("00dc");
  aviWriteU32((uint32_t)len);
  aviFile.write(jpegData, len);

  // Pad to even boundary
  if (len & 1) {
    uint8_t pad = 0;
    aviFile.write(&pad, 1);
    aviTotalSize += (uint32_t)len + 9;
  } else {
    aviTotalSize += (uint32_t)len + 8;
  }

  aviFrameCount++;
}

static void aviFinalize() {
  if (!aviFile) return;

  uint32_t moviSize = aviTotalSize + 4;
  uint32_t usPerFrame = 1000000 / 30; //30fps

  uint32_t hdrlSize = 4 + 64 + (4 + 8 + 64 + 48);
  uint32_t strlSize = 4 + 64 + 48;
  uint32_t riffSize = 4 + (8 + hdrlSize) + (8 + moviSize);

  aviFile.seek(0);

  // RIFF header
  aviWriteFourCC("RIFF");
  aviWriteU32(riffSize);
  aviWriteFourCC("AVI ");

  // LIST hdrl
  aviWriteFourCC("LIST");
  aviWriteU32(hdrlSize);
  aviWriteFourCC("hdrl");

  // avih (Main AVI Header) — 56 bytes
  aviWriteFourCC("avih");
  aviWriteU32(56);
  aviWriteU32(usPerFrame);
  aviWriteU32(0);
  aviWriteU32(0);
  aviWriteU32(0);
  aviWriteU32(aviFrameCount);
  aviWriteU32(0);
  aviWriteU32(1);
  aviWriteU32(0);
  aviWriteU32(aviWidth);
  aviWriteU32(aviHeight);
  aviWriteU32(0); aviWriteU32(0);
  aviWriteU32(0); aviWriteU32(0);

  // LIST strl
  aviWriteFourCC("LIST");
  aviWriteU32(strlSize);
  aviWriteFourCC("strl");

  // strh (Stream Header) — 56 bytes
  aviWriteFourCC("strh");
  aviWriteU32(56);
  aviWriteFourCC("vids");
  aviWriteFourCC("MJPG");
  aviWriteU32(0);
  aviWriteU16(0);
  aviWriteU16(0);
  aviWriteU32(0);
  aviWriteU32(1);
  aviWriteU32(30); //30 fps
  aviWriteU32(0);
  aviWriteU32(aviFrameCount);
  aviWriteU32(0);
  aviWriteU32(0);
  aviWriteU32(0);
  aviWriteU16(0); aviWriteU16(0);
  aviWriteU16(aviWidth);
  aviWriteU16(aviHeight);

  // strf (BITMAPINFOHEADER) — 40 bytes
  aviWriteFourCC("strf");
  aviWriteU32(40);
  aviWriteU32(40);
  aviWriteU32(aviWidth);
  aviWriteU32(aviHeight);
  aviWriteU16(1);
  aviWriteU16(24);
  aviWriteFourCC("MJPG");
  aviWriteU32(aviWidth * aviHeight * 3);
  aviWriteU32(0);
  aviWriteU32(0);
  aviWriteU32(0);
  aviWriteU32(0);

  // LIST movi header
  aviWriteFourCC("LIST");
  aviWriteU32(moviSize);
  aviWriteFourCC("movi");

  aviFile.close();

  Serial.print("AVI finalized: ");
  Serial.print(aviFrameCount);
  Serial.print(" frames, ");
  Serial.print((riffSize + 8) / 1024);
  Serial.println(" KB");
}


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
    config.jpeg_quality = 10;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

    if (psramFound()) {
        LOG_INFO("PSRAM found — using 2 frame buffers.");
        config.fb_count  = 2;
        config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
        LOG_INFO("No PSRAM — using DRAM with QVGA (320x240).");
        config.fb_location = CAMERA_FB_IN_DRAM;
        config.frame_size = FRAMESIZE_QVGA;  // 320x240 fits in DRAM
        config.jpeg_quality = 12;
        config.fb_count = 1;
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
    camera_fb_t *pic = esp_camera_fb_get();

    if (!pic) {
        LOG_ERROR("Failed to capture frame");
        return false;
    }

    fb.buffer = pic->buf;
    fb.length = pic->len;
    fb.timestamp = millis();
    frame_count++;
    
    esp_camera_fb_return(pic);

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
        pic.len = fb.length;
        esp_camera_fb_return((camera_fb_t*)&pic);
        fb.buffer = nullptr;
        fb.length = 0;
        
        LOG_INFO("Clear buffer");
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


void CameraModule::recordVideoAVI(fs::FS &fs, const char* filename){
    // Start AVI file
    LOG_INFO("recordVideoAVI Start %s",filename);
    
    if (!aviStart(SD_MMC, filename)) {
        esp_camera_deinit();
        return;
    }
    LOG_INFO("recordVideoAVI Start end");
    unsigned long frameInterval = 1000 / 30; // 1000 divide by fps
    unsigned long recordStart = millis();
    unsigned long lastFrame = 0;
    unsigned long duration = 10;

    while (millis() - recordStart < (unsigned long)duration * 1000) {
        unsigned long now = millis();
        if (now - lastFrame < frameInterval) continue;
        lastFrame = now;

        camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      LOG_INFO("Frame capture failed");
      continue;
    }

    aviWriteFrame(fb->buf, fb->len);
    esp_camera_fb_return(fb);
    }

    aviFinalize();
}


