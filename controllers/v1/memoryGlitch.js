import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { generateTextPair } from '../../services/memoryGlitch.js';

export const postGenerate = async (req, res) => {
  try {
    const { difficulty = 'easy' } = req.body;
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;

    logger.info(`MEMORY_GLITCH REQ | ip=${clientIp} | difficulty=${difficulty}`);

    const startTime = Date.now();
    const textPair = await generateTextPair(difficulty);
    const responseTime = Date.now() - startTime;

    logger.info(`MEMORY_GLITCH RES | ${responseTime}ms | title="${textPair.title}"`);

    return responseHelper.success(res, textPair, 'Text pair generated');
  } catch (controllerError) {
    logger.error(`postGenerate error: ${controllerError.message}`, { service: 'MemoryGlitchController' });
    return responseHelper.error(res, controllerError.message || 'Failed to generate text pair');
  }
};
