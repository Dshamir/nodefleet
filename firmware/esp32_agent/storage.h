#ifndef STORAGE_H
#define STORAGE_H

#include <Arduino.h>
#include <vector>

typedef struct {
    String file_path;
    String file_name;
    size_t file_size;
    uint32_t timestamp;
    String type;  // "photo", "video", "audio", "log"
} QueuedFile;

class StorageManager {
public:
    StorageManager();

    // NVS (Non-Volatile Storage) for device tokens
    bool nvs_begin(const char* namespace_name = "nodefleet");
    bool nvs_saveDeviceToken(const String& token);
    bool nvs_loadDeviceToken(String& token);
    bool nvs_savePairingCode(const String& code);
    bool nvs_loadPairingCode(String& code);
    bool nvs_saveConfig(const String& key, const String& value);
    bool nvs_loadConfig(const String& key, String& value);
    bool nvs_clear();

    // SD Card operations
    bool sd_begin(int cs_pin);
    bool sd_end();
    bool sd_isReady();

    // File operations
    bool sd_writeFile(const String& path, const uint8_t* data, size_t data_len);
    bool sd_appendFile(const String& path, const uint8_t* data, size_t data_len);
    bool sd_readFile(const String& path, uint8_t* buffer, size_t buffer_size, size_t& bytes_read);
    bool sd_deleteFile(const String& path);
    bool sd_fileExists(const String& path);
    size_t sd_getFileSize(const String& path);

    // Directory operations
    bool sd_createDir(const String& path);
    bool sd_removeDir(const String& path);
    std::vector<String> sd_listDir(const String& path);

    // Offline queue management
    bool queue_addFile(const String& file_path, const String& file_type);
    bool queue_removeFile(const String& file_path);
    std::vector<QueuedFile> queue_getFiles(const String& type = "");
    size_t queue_getCount();
    size_t queue_getTotalSize();
    bool queue_clear();

    // Storage info
    size_t sd_getFreeSpace();
    size_t sd_getTotalSpace();
    float sd_getUsagePercent();

    // Logging
    bool LOG_writeLog(const String& message);
    bool LOG_readLog(uint32_t offset, String& data, size_t max_size);

private:
    bool sd_ready;
    int sd_cs_pin;

    String queue_dir;
    String LOG_dir;
};

#endif // STORAGE_H
