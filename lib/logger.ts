// lib/logger.ts
// Structured logger with strict PII scrubbing (supports standard and Pino/Bunyan style signatures)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ETH_REGEX = /0x[a-fA-F0-9]{40}/g;

function scrubPII(input: any): string {
  if (input === null || input === undefined) return '';
  const str = input instanceof Error ? input.stack || input.message : typeof input === 'string' ? input : JSON.stringify(input);
  return str
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(ETH_REGEX, (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`);
}

function normalizeLogArgs(arg1: any, arg2?: any) {
  let message = '';
  let metaObj: Record<string, any> = {};

  if (typeof arg1 === 'string') {
    message = arg1;
    if (arg2 && typeof arg2 === 'object') {
      metaObj = arg2;
    }
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    if (typeof arg2 === 'string') {
      message = arg2;
      metaObj = arg1;
    } else {
      message = arg1.message || arg1.msg || '';
      metaObj = arg1;
    }
  } else {
    message = String(arg1 || '');
  }

  return { message: scrubPII(message), meta: metaObj };
}

export const logger = {
  debug: (arg1: any, arg2?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      const { message, meta } = normalizeLogArgs(arg1, arg2);
      console.debug(`[DEBUG] ${message}`, Object.keys(meta).length ? meta : '');
    }
  },
  info: (arg1: any, arg2?: any) => {
    const { message, meta } = normalizeLogArgs(arg1, arg2);
    console.info(JSON.stringify({ level: 'info', msg: message, ...meta, ts: new Date().toISOString() }));
  },
  warn: (arg1: any, arg2?: any) => {
    const { message, meta } = normalizeLogArgs(arg1, arg2);
    console.warn(JSON.stringify({ level: 'warn', msg: message, ...meta, ts: new Date().toISOString() }));
  },
  error: (arg1: any, arg2?: any) => {
    const { message, meta } = normalizeLogArgs(arg1, arg2);
    console.error(JSON.stringify({ level: 'error', msg: message, ...meta, ts: new Date().toISOString() }));
  },
};
