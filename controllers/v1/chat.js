import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { sendChat } from '../../services/chat.js';

export const postChat = async (req, res) => {
  try {
    const { message, history = [], model, context = 'general' } = req.body;
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;

    logger.info(`CHAT REQ | ip=${clientIp} | model=${model || 'default'} | context=${context} | msg="${message}"`);

    if (!message) {
      return responseHelper.error(res, 'message is required', 400);
    }

    const startTime = Date.now();
    const chatResult = await sendChat(message, history, model, context);
    const responseTime = Date.now() - startTime;

    logger.info(`CHAT RES | ${responseTime}ms | source=${chatResult.source} | reply="${chatResult.reply.substring(0, 80)}..."`);

    return responseHelper.success(res, chatResult, 'Chat response');
  } catch (controllerError) {
    logger.error(`postChat error: ${controllerError.message}`, { service: 'ChatController' });
    return responseHelper.error(res, 'Failed to get chat response');
  }
};

export const getHealth = async (req, res) => {
  try {
    return responseHelper.success(res, {
      time: new Date().toISOString(),
      uptime: process.uptime(),
    }, 'Server is healthy');
  } catch (controllerError) {
    return responseHelper.error(res, 'Health check failed');
  }
};
