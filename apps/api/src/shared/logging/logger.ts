import { getRequestId } from '../context/request-context.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'cookie',
];

/** Recursively redacts values under sensitive keys so logs never leak secrets/PII (docs/11 §4). */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.includes(key.toLowerCase()) ? '[REDACTED]' : redact(val);
    }
    return out;
  }
  return value;
}

export type LogFields = Record<string, unknown>;

/** Minimal structured JSON logger. Always includes the active requestId. */
export class StructuredLogger {
  constructor(private readonly level: LogLevel = 'info') {}

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const line = {
      level,
      time: new Date().toISOString(),
      requestId: getRequestId(),
      msg: message,
      ...(fields ? (redact(fields) as LogFields) : {}),
    };
    const sink = level === 'error' ? console.error : console.log;
    sink(JSON.stringify(line));
  }

  debug(message: string, fields?: LogFields): void {
    this.write('debug', message, fields);
  }
  info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }
  warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }
  error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }
}
