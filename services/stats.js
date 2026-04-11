import os from 'os';
import { OLLAMA_URL } from '../helpers/constants.js';

export async function getServerStats() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  let ollamaStatus = 'offline';
  let ollamaModels = [];
  let ollamaResponseTime = null;

  try {
    const startTime = Date.now();
    const tagsResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    ollamaResponseTime = Date.now() - startTime;

    if (tagsResponse.ok) {
      ollamaStatus = 'online';
      const tagsData = await tagsResponse.json();
      ollamaModels = (tagsData.models || []).map(model => ({
        name: model.name,
        size: model.size,
        modified: model.modified_at,
      }));
    }
  } catch {
    ollamaStatus = 'offline';
  }

  return {
    server: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      hostname: os.hostname(),
      cpuCores: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'unknown',
      loadAverage: os.loadavg(),
    },
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usagePercent: Math.round((usedMemory / totalMemory) * 100),
    },
    ollama: {
      status: ollamaStatus,
      url: OLLAMA_URL,
      responseTime: ollamaResponseTime,
      models: ollamaModels,
    },
    timestamp: new Date().toISOString(),
  };
}
