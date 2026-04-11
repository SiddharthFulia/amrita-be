import { PORT, OLLAMA_URL } from './helpers/constants.js';
import http from 'http';
import app from './app.js';
import { logger } from './helpers/logger.js';

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`amrita-be running on http://localhost:${PORT}`);
  logger.info(`Ollama endpoint: ${OLLAMA_URL}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});
