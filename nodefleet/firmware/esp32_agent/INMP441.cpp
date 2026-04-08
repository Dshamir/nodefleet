#include "INMP441.h"
#include <driver/i2s.h>
#include "config.h"

// ============================================================
// WAV Header (44 bytes)
// ============================================================
struct WavHeader {
  char     riff[4]       = {'R','I','F','F'};
  uint32_t fileSize      = 0;   // filled after recording
  char     wave[4]       = {'W','A','V','E'};
  char     fmt[4]        = {'f','m','t',' '};
  uint32_t fmtSize       = 16;
  uint16_t audioFormat   = 1;   // PCM
  uint16_t numChannels   = INMP441_CHANNELS;
  uint32_t sampleRate    = INMP441_SAMPLE_RATE;
  uint32_t byteRate      = 0;   // filled below
  uint16_t blockAlign    = 0;   // filled below
  uint16_t bitsPerSample = INMP441_BITS_PER_SAMPLE;
  char     data[4]       = {'d','a','t','a'};
  uint32_t dataSize      = 0;   // filled after recording
};

// ============================================================
// Init / Deinit
// ============================================================

bool inmp441_init() {
  i2s_config_t i2s_config = {};
  i2s_config.mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
  i2s_config.sample_rate          = INMP441_SAMPLE_RATE;
  i2s_config.bits_per_sample      = (i2s_bits_per_sample_t)INMP441_BITS_PER_SAMPLE;
  i2s_config.channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT;
  i2s_config.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  i2s_config.intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1;
  i2s_config.dma_buf_count        = INMP441_DMA_BUF_COUNT;
  i2s_config.dma_buf_len          = INMP441_DMA_BUF_LEN;
  i2s_config.use_apll             = false;
  i2s_config.tx_desc_auto_clear   = false;
  i2s_config.fixed_mclk           = 0;

  esp_err_t err = i2s_driver_install((i2s_port_t)INMP441_I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    //Serial.printf("INMP441: i2s_driver_install failed (%d)\n", err);
    return false;
  }

  i2s_pin_config_t pin_config = {};
  pin_config.bck_io_num   = INMP441_SCK;
  pin_config.ws_io_num    = INMP441_WS;
  pin_config.data_out_num = I2S_PIN_NO_CHANGE;
  pin_config.data_in_num  = INMP441_SD;

  err = i2s_set_pin((i2s_port_t)INMP441_I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    //Serial.printf("INMP441: i2s_set_pin failed (%d)\n", err);
    i2s_driver_uninstall((i2s_port_t)INMP441_I2S_PORT);
    return false;
  }

  i2s_zero_dma_buffer((i2s_port_t)INMP441_I2S_PORT);
  delay(100);  // INMP441 power-up time

  // Discard first DMA buffer of stale data
  int32_t discard[256];
  size_t d = 0;
  i2s_read((i2s_port_t)INMP441_I2S_PORT, discard, sizeof(discard), &d, 500);

  //Serial.println("INMP441: init OK");
  return true;
}

void inmp441_deinit() {
  i2s_zero_dma_buffer((i2s_port_t)INMP441_I2S_PORT);
  i2s_stop((i2s_port_t)INMP441_I2S_PORT);
  delay(100);  // Let Core 0 IDLE task run — prevents TG1WDT_SYS_RST
  i2s_driver_uninstall((i2s_port_t)INMP441_I2S_PORT);
  delay(100);  // Settle after driver removal
  //Serial.println("INMP441: deinit");
}

// ============================================================
// Raw Read
// ============================================================

int inmp441_read(int16_t* buf, size_t maxBytes) {
  size_t bytesRead = 0;
  esp_err_t err = i2s_read(
    (i2s_port_t)INMP441_I2S_PORT,
    (void*)buf,
    maxBytes,
    &bytesRead,
    portMAX_DELAY
  );
  if (err != ESP_OK) return -1;
  return (int)bytesRead;
}

// ============================================================
// Record WAV to filesystem
// ============================================================

bool inmp441_record_wav(fs::FS &fs, const char* path, int durationSec) {
  LOG_INFO("Open file %s",path);
  File f = fs.open(path, FILE_WRITE);
  if (!f) {
    //Serial.printf("INMP441: failed to open %s\n", path);
    return false;
  }

  // Write placeholder WAV header — output is always 16-bit PCM
  WavHeader hdr;
  hdr.bitsPerSample = INMP441_OUTPUT_BITS;
  hdr.byteRate   = INMP441_SAMPLE_RATE * INMP441_CHANNELS * (INMP441_OUTPUT_BITS / 8);
  hdr.blockAlign = INMP441_CHANNELS * (INMP441_OUTPUT_BITS / 8);
  f.write((const uint8_t*)&hdr, sizeof(hdr));

  // I2S reads 32-bit samples, we convert to 16-bit for WAV
  const int BUF_SAMPLES = 512;
  int32_t rawBuf[BUF_SAMPLES];           // 32-bit from I2S
  int16_t outBuf[BUF_SAMPLES];           // 16-bit for WAV
  const size_t readBytes = BUF_SAMPLES * sizeof(int32_t);

  uint32_t totalDataBytes = 0;
  uint32_t targetBytes = (uint32_t)durationSec * hdr.byteRate;

  //Serial.printf("INMP441: recording %ds to %s\n", durationSec, path);

  unsigned long startMs = millis();
  bool debugPrinted = false;

  while (totalDataBytes < targetBytes) {
    size_t bytesRead = 0;
    esp_err_t err = i2s_read((i2s_port_t)INMP441_I2S_PORT, rawBuf, readBytes, &bytesRead, portMAX_DELAY);
    if (err != ESP_OK || bytesRead == 0) {
      //Serial.println("INMP441: read error");
      break;
    }

    int samplesRead = bytesRead / sizeof(int32_t);

    // Debug: print first 10 raw samples to diagnose data format
    if (!debugPrinted && samplesRead > 0) {
      debugPrinted = true;
      //Serial.print("INMP441 raw samples: ");
      for (int i = 0; i < 10 && i < samplesRead; i++) {
        //Serial.printf("0x%08X ", rawBuf[i]);
      }
      //Serial.println();
    }

    // Convert 32-bit I2S samples to 16-bit WAV: shift right 16 to get upper bits, then apply gain
    for (int i = 0; i < samplesRead; i++) {
      int32_t sample = (rawBuf[i] >> 16) * INMP441_GAIN;
      if (sample > 32767) sample = 32767;
      else if (sample < -32768) sample = -32768;
      outBuf[i] = (int16_t)sample;
    }

    int outBytes = samplesRead * sizeof(int16_t);
    f.write((const uint8_t*)outBuf, outBytes);
    totalDataBytes += outBytes;
  }

  unsigned long elapsed = millis() - startMs;
  //Serial.printf("INMP441: recorded %u bytes in %lums\n", totalDataBytes, elapsed);

  // Patch WAV header with final sizes
  hdr.dataSize = totalDataBytes;
  hdr.fileSize = totalDataBytes + sizeof(hdr) - 8;

  f.seek(0);
  f.write((const uint8_t*)&hdr, sizeof(hdr));
  f.close();

  //Serial.printf("INMP441: saved %s (%u bytes)\n", path, totalDataBytes + (uint32_t)sizeof(hdr));
  return true;
}
