#ifndef INMP441_H
#define INMP441_H

#include <Arduino.h>
#include <FS.h>

// ============================================================
// INMP441 Pin Definitions — change these for your wiring
// ============================================================
#define INMP441_WS   21    // Word Select (LRCLK)
#define INMP441_SD   19   // Serial Data (DOUT)
#define INMP441_SCK  20   // Serial Clock (BCLK)

// ============================================================
// Recording Defaults
// ============================================================
#define INMP441_SAMPLE_RATE     44100
#define INMP441_BITS_PER_SAMPLE 32      // INMP441 outputs 24-bit data in 32-bit frames
#define INMP441_OUTPUT_BITS     16      // We save 16-bit WAV
#define INMP441_CHANNELS        1
#define INMP441_I2S_PORT        I2S_NUM_0

// Buffer size for I2S reads (in bytes)
#define INMP441_DMA_BUF_COUNT   8
#define INMP441_DMA_BUF_LEN     1024

// Gain multiplier (adjust if too quiet or clipping: try 2-16)
#define INMP441_GAIN            4

// ============================================================
// API
// ============================================================

// Initialize I2S peripheral for the INMP441 mic.
// Call once before any recording. Returns true on success.
bool inmp441_init();

// Deinitialize I2S — frees the peripheral for other use.
void inmp441_deinit();

// Read raw 16-bit PCM samples into buffer.
// Returns number of bytes actually read.
// `buf` must be at least `maxBytes` large.
int inmp441_read(int16_t* buf, size_t maxBytes);

// Record `durationSec` seconds of audio and write a WAV file to `fs`.
// `path` is the full file path, e.g. "/audio/aud_00000.wav".
// Returns true on success.
bool inmp441_record_wav(fs::FS &fs, const char* path, int durationSec);

#endif // INMP441_H
