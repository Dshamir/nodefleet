import { randomUUID } from 'crypto'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isDev = process.env.NODE_ENV !== 'production'
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isDev ? 'debug' : 'info')

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  correlationId?: string
  [key: string]: unknown
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function formatOutput(entry: LogEntry): string {
  if (isDev) {
    const { timestamp, level, module, message, correlationId, ...rest } = entry
    const ts = new Date(timestamp).toLocaleTimeString()
    const prefix = `[${ts}] ${level.toUpperCase().padEnd(5)} [${module}]`
    const cid = correlationId ? ` (${correlationId.slice(0, 8)})` : ''
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
    return `${prefix}${cid} ${message}${extra}`
  }
  return JSON.stringify(entry)
}

function emit(level: LogLevel, entry: LogEntry): void {
  const output = formatOutput(entry)
  switch (level) {
    case 'debug':
      console.debug(output)
      break
    case 'info':
      console.info(output)
      break
    case 'warn':
      console.warn(output)
      break
    case 'error':
      console.error(output)
      break
  }
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  withCorrelationId(id: string): Logger
}

export function createLogger(module: string, correlationId?: string): Logger {
  const cid = correlationId || randomUUID()

  function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      correlationId: cid,
      ...context,
    }

    emit(level, entry)
  }

  return {
    debug: (message, context?) => log('debug', message, context),
    info: (message, context?) => log('info', message, context),
    warn: (message, context?) => log('warn', message, context),
    error: (message, context?) => log('error', message, context),
    withCorrelationId: (id: string) => createLogger(module, id),
  }
}

const logger = createLogger('app')
export default logger
