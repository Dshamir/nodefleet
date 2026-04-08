#include "storage.h"
#include "config.h"

#if ENABLE_NVS
#include <nvs_flash.h>
#include <nvs.h>
#endif

#if ENABLE_SD_CARD
//#include <SD.h>
//#include <SPI.h>
#include <SD_MMC.h>
#include <FS.h>
#include <SPI.h>
#endif

StorageManager::StorageManager() : sd_ready(false), sd_cs_pin(-1) {
    queue_dir = "/queue";
    log_dir = "/logs";
}

// ============================================================================
// NVS (Non-Volatile Storage) Functions
// ============================================================================

bool StorageManager::nvs_begin(const char* namespace_name) {
#if ENABLE_NVS
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        LOG_WARN("NVS partition needs erasing");
        nvs_flash_erase();
        nvs_flash_init();
    }
    LOG_INFO("NVS initialized with namespace: %s", namespace_name);
    return true;
#else
    return false;
#endif
}

bool StorageManager::nvs_saveDeviceToken(const String& token) {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        LOG_ERROR("Failed to open NVS handle");
        return false;
    }

    err = nvs_set_str(handle, "device_token", token.c_str());
    if (err != ESP_OK) {
        LOG_ERROR("Failed to save device token");
        nvs_close(handle);
        return false;
    }

    nvs_commit(handle);
    nvs_close(handle);

    LOG_INFO("Device token saved to NVS");
    return true;
#else
    return false;
#endif
}

bool StorageManager::nvs_loadDeviceToken(String& token) {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READONLY, &handle);
    if (err != ESP_OK) {
        LOG_VERBOSE("NVS namespace not found");
        return false;
    }

    char token_buf[512];
    size_t len = sizeof(token_buf);
    err = nvs_get_str(handle, "device_token", token_buf, &len);
    nvs_close(handle);

    if (err == ESP_OK) {
        token = String(token_buf);
        LOG_INFO("Device token loaded from NVS");
        return true;
    }

    return false;
#else
    return false;
#endif
}

bool StorageManager::nvs_savePairingCode(const String& code) {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return false;
    }

    nvs_set_str(handle, "pairing_code", code.c_str());
    nvs_commit(handle);
    nvs_close(handle);

    return true;
#else
    return false;
#endif
}

bool StorageManager::nvs_loadPairingCode(String& code) {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READONLY, &handle);
    if (err != ESP_OK) {
        return false;
    }

    char code_buf[64];
    size_t len = sizeof(code_buf);
    err = nvs_get_str(handle, "pairing_code", code_buf, &len);
    nvs_close(handle);

    if (err == ESP_OK) {
        code = String(code_buf);
        return true;
    }

    return false;
#else
    return false;
#endif
}

bool StorageManager::nvs_saveConfig(const String& key, const String& value) {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return false;
    }

    nvs_set_str(handle, key.c_str(), value.c_str());
    nvs_commit(handle);
    nvs_close(handle);

    return true;
#else
    return false;
#endif
}

bool StorageManager::nvs_loadConfig(const String& key, String& value) {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READONLY, &handle);
    if (err != ESP_OK) {
        return false;
    }

    char val_buf[256];
    size_t len = sizeof(val_buf);
    err = nvs_get_str(handle, key.c_str(), val_buf, &len);
    nvs_close(handle);

    if (err == ESP_OK) {
        value = String(val_buf);
        return true;
    }

    return false;
#else
    return false;
#endif
}

bool StorageManager::nvs_clear() {
#if ENABLE_NVS
    nvs_handle_t handle;
    esp_err_t err = nvs_open("nodefleet", NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return false;
    }

    nvs_erase_all(handle);
    nvs_commit(handle);
    nvs_close(handle);

    return true;
#else
    return false;
#endif
}

// ============================================================================
// SD Card Functions
// ============================================================================

bool StorageManager::sd_begin(int cs_pin) {
#if ENABLE_SD_CARD
    sd_cs_pin = cs_pin;

    // Initialize SD card in SDMMC 1-bit mode (pins defined in config.h)
    if (!SD_MMC.setPins(SDMMC_CLK, SDMMC_CMD, SDMMC_DATA)) {
        LOG_ERROR("SD_MMC pin config failed");
        return false;
    }

    if (!SD_MMC.begin("/sdcard", true)) {  // true = 1-bit mode
        LOG_ERROR("SD card initialization failed");
        return false;
    }

    uint8_t card_type = SD_MMC.cardType();
    if (card_type == CARD_NONE) {
        LOG_ERROR("No SD card detected");
        return false;
    }

    uint64_t card_size = SD_MMC.cardSize() / (1024 * 1024);
    LOG_INFO("SD Card Type: %d, Size: %lld MB", card_type, card_size);

    sd_ready = true;

    // Create directories if they don't exist
    sd_createDir(queue_dir);
    sd_createDir(log_dir);
    sd_createDir("/photos");
    sd_createDir("/videos");

    return true;
#else
    return false;
#endif
}

bool StorageManager::sd_end() {
#if ENABLE_SD_CARD
    SD_MMC.end();
    sd_ready = false;
    return true;
#else
    return false;
#endif
}

bool StorageManager::sd_isReady() {
    return sd_ready;
}

bool StorageManager::sd_writeFile(const String& path, const uint8_t* data, size_t data_len) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        LOG_ERROR("SD card not ready");
        return false;
    }

    File file = SD_MMC.open(path, FILE_WRITE);
    if (!file) {
        LOG_ERROR("Failed to open file for writing: %s", path.c_str());
        return false;
    }

    size_t written = file.write(data, data_len);
    file.close();

    if (written != data_len) {
        LOG_ERROR("Failed to write all data: %d/%d bytes", written, data_len);
        return false;
    }

    LOG_VERBOSE("Wrote %d bytes to %s", written, path.c_str());
    return true;
#else
    return false;
#endif
}

bool StorageManager::sd_appendFile(const String& path, const uint8_t* data, size_t data_len) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    File file = SD_MMC.open(path, FILE_APPEND);
    if (!file) {
        LOG_ERROR("Failed to open file for appending: %s", path.c_str());
        return false;
    }

    size_t written = file.write(data, data_len);
    file.close();

    return written == data_len;
#else
    return false;
#endif
}

bool StorageManager::sd_readFile(const String& path, uint8_t* buffer, size_t buffer_size, size_t& bytes_read) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    File file = SD_MMC.open(path, FILE_READ);
    if (!file) {
        LOG_ERROR("Failed to open file for reading: %s", path.c_str());
        return false;
    }

    bytes_read = file.readBytes((char*)buffer, buffer_size);
    file.close();

    LOG_VERBOSE("Read %d bytes from %s", bytes_read, path.c_str());
    return true;
#else
    return false;
#endif
}

bool StorageManager::sd_deleteFile(const String& path) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    if (!SD_MMC.remove(path)) {
        LOG_ERROR("Failed to delete file: %s", path.c_str());
        return false;
    }

    LOG_INFO("Deleted file: %s", path.c_str());
    return true;
#else
    return false;
#endif
}

bool StorageManager::sd_fileExists(const String& path) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }
    return SD_MMC.exists(path);
#else
    return false;
#endif
}

size_t StorageManager::sd_getFileSize(const String& path) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return 0;
    }

    File file = SD_MMC.open(path, FILE_READ);
    if (!file) {
        return 0;
    }

    size_t size = file.size();
    file.close();
    return size;
#else
    return 0;
#endif
}

bool StorageManager::sd_createDir(const String& path) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    if (SD_MMC.exists(path)) {
        return true;
    }

    return SD_MMC.mkdir(path);
#else
    return false;
#endif
}

bool StorageManager::sd_removeDir(const String& path) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }
    return SD_MMC.rmdir(path);
#else
    return false;
#endif
}

std::vector<String> StorageManager::sd_listDir(const String& path) {
    std::vector<String> files;

#if ENABLE_SD_CARD
    if (!sd_ready) {
        return files;
    }

    File dir = SD_MMC.open(path);
    if (!dir || !dir.isDirectory()) {
        LOG_ERROR("Failed to open directory: %s", path.c_str());
        return files;
    }

    File file = dir.openNextFile();
    while (file) {
        files.push_back(String(file.name()));
        file = dir.openNextFile();
    }

    dir.close();
#endif

    return files;
}

// ============================================================================
// Offline Queue Management
// ============================================================================

bool StorageManager::queue_addFile(const String& file_path, const String& file_type) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        LOG_WARN("SD card not ready, cannot queue file");
        return false;
    }

    // Create queue entry file
    String queue_file = queue_dir + "/" + String(millis()) + ".json";

    String json = "{\"file\":\"" + file_path + "\",\"type\":\"" + file_type + "\",\"timestamp\":" + String(millis()) + "}";

    return sd_writeFile(queue_file, (uint8_t*)json.c_str(), json.length());
#else
    return false;
#endif
}

bool StorageManager::queue_removeFile(const String& file_path) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    // Find and remove queue entry
    std::vector<String> queue_files = sd_listDir(queue_dir);
    for (const auto& qf : queue_files) {
        String full_path = queue_dir + "/" + qf;
        // Check if this queue file references the target file
        // For simplicity, just remove based on name matching
        sd_deleteFile(full_path);
    }

    return true;
#else
    return false;
#endif
}

std::vector<QueuedFile> StorageManager::queue_getFiles(const String& type) {
    std::vector<QueuedFile> result;

#if ENABLE_SD_CARD
    if (!sd_ready) {
        return result;
    }

    std::vector<String> queue_files = sd_listDir(queue_dir);

    for (const auto& qf : queue_files) {
        String full_path = queue_dir + "/" + qf;

        // Read queue file
        uint8_t buffer[256];
        size_t bytes_read;
        if (!sd_readFile(full_path, buffer, sizeof(buffer), bytes_read)) {
            continue;
        }

        String json = String((char*)buffer).substring(0, bytes_read);

        // Parse JSON (simplified)
        int file_start = json.indexOf("\"file\":\"") + 8;
        int file_end = json.indexOf("\"", file_start);
        String file_path = json.substring(file_start, file_end);

        int type_start = json.indexOf("\"type\":\"") + 8;
        int type_end = json.indexOf("\"", type_start);
        String file_type = json.substring(type_start, type_end);

        if (type == "" || type == file_type) {
            QueuedFile qf;
            qf.file_path = file_path;
            qf.file_name = file_path.substring(file_path.lastIndexOf("/") + 1);
            qf.file_size = sd_getFileSize(file_path);
            qf.type = file_type;
            qf.timestamp = millis();

            result.push_back(qf);
        }
    }
#endif

    return result;
}

size_t StorageManager::queue_getCount() {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return 0;
    }
    return sd_listDir(queue_dir).size();
#else
    return 0;
#endif
}

size_t StorageManager::queue_getTotalSize() {
    size_t total = 0;

#if ENABLE_SD_CARD
    std::vector<QueuedFile> files = queue_getFiles();
    for (const auto& f : files) {
        total += f.file_size;
    }
#endif

    return total;
}

bool StorageManager::queue_clear() {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    std::vector<String> files = sd_listDir(queue_dir);
    for (const auto& f : files) {
        sd_deleteFile(queue_dir + "/" + f);
    }

    return true;
#else
    return false;
#endif
}

// ============================================================================
// Storage Info
// ============================================================================

size_t StorageManager::sd_getFreeSpace() {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return 0;
    }
    // Note: ESP32 SD library doesn't directly provide free space
    // This is a placeholder
    return SD_MMC.cardSize() / 4;  // Approximate
#else
    return 0;
#endif
}

size_t StorageManager::sd_getTotalSpace() {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return 0;
    }
    return SD_MMC.cardSize();
#else
    return 0;
#endif
}

float StorageManager::sd_getUsagePercent() {
    size_t total = sd_getTotalSpace();
    if (total == 0) {
        return 0.0;
    }
    return (float)(total - sd_getFreeSpace()) / total * 100.0;
}

// ============================================================================
// Logging
// ============================================================================

bool StorageManager::log_writeLog(const String& message) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    String timestamp = "[" + String(millis()) + "] ";
    String log_entry = timestamp + message + "\n";

    String log_file = log_dir + "/device.log";
    return sd_appendFile(log_file, (uint8_t*)log_entry.c_str(), log_entry.length());
#else
    return false;
#endif
}

bool StorageManager::log_readLog(uint32_t offset, String& data, size_t max_size) {
#if ENABLE_SD_CARD
    if (!sd_ready) {
        return false;
    }

    String log_file = log_dir + "/device.log";
    uint8_t buffer[1024];
    size_t bytes_read;

    if (!sd_readFile(log_file, buffer, min(sizeof(buffer), max_size), bytes_read)) {
        return false;
    }

    data = String((char*)buffer).substring(0, bytes_read);
    return true;
#else
    return false;
#endif
}
