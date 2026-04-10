// ─── Simple Logger ───────────────────────────────────────────────────────────

const timestamp = () => new Date().toISOString();

const logger = {
  info: (msg, meta = {}) => {
    console.log(`[${timestamp()}] INFO: ${msg}`, Object.keys(meta).length ? meta : '');
  },
  error: (msg, meta = {}) => {
    console.error(`[${timestamp()}] ERROR: ${msg}`, Object.keys(meta).length ? meta : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[${timestamp()}] WARN: ${msg}`, Object.keys(meta).length ? meta : '');
  },
};

export { logger };
