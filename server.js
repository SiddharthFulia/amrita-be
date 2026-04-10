// ─── Server Entry Point ──────────────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { logger } from './helpers/logger.js';

const PORT = process.env.PORT || 4001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`amrita-be running on http://localhost:${PORT}`);
  logger.info(`Ollama endpoint: ${OLLAMA_URL}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});
