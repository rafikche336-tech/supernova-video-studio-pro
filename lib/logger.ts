/**
 * Minimal structured logger.
 *
 * Emits one JSON object per line so that hosting platforms (Vercel, Docker,
 * Loki, CloudWatch…) can index the fields without a parser. Swap the sink for
 * pino/Sentry in production — the call sites do not change.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...context,
  });

  // Warnings/errors go to stderr so they are captured even if stdout is muted.
  if (level === 'warn' || level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
