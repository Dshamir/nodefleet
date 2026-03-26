export const config = {
  deviceCount: parseInt(process.env.DEVICE_COUNT || '5', 10),
  devicePrefix: process.env.DEVICE_PREFIX || 'ZENZERS',
  wsPort: parseInt(process.env.WS_PORT || '8765', 10),
  readingIntervalMs: parseInt(process.env.READING_INTERVAL_MS || '5000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  serialPrefix: process.env.SERIAL_PREFIX || 'ZNZ-2026',
};
