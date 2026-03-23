#ifndef CAMERA_H
#define CAMERA_H

#include <Arduino.h>

typedef struct {
    uint8_t* buffer;
    size_t length;
    uint32_t timestamp;
} FrameBuffer;

class CameraModule {
public:
    CameraModule();

    // Initialization
    bool begin();
    bool end();

    // Capture operations
    bool captureJPEG(FrameBuffer& fb);
    bool captureRaw(FrameBuffer& fb);

    // Frame buffer management
    void releaseFrameBuffer(FrameBuffer& fb);

    // Configuration
    bool setResolution(uint16_t width, uint16_t height);
    bool setQuality(uint8_t quality);  // 10-63
    bool setFrameRate(uint8_t fps);

    // Status
    bool isReady();
    uint32_t getFrameCount();

private:
    bool camera_ready;
    uint32_t frame_count;

    bool initializeCamera();
    bool configureCamera();
};

#endif // CAMERA_H
