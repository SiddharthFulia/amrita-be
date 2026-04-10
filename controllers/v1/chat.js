// ─── Chat Controller ─────────────────────────────────────────────────────────

import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { sendChat } from '../../services/chat.js';

export const postChat = async (req, res) => {
  try {
    const { message, history = [], model } = req.body;

    if (!message) {
      return responseHelper.error(res, 'message is required', 400);
    }

    const result = await sendChat(message, history, model);
    return responseHelper.success(res, result, 'Chat response');

  } catch (err) {
    logger.error(`postChat error: ${err.message}`, { service: 'ChatController' });
    return responseHelper.error(res, 'Failed to get chat response');
  }
};

export const getHealth = async (req, res) => {
  try {
    return responseHelper.success(res, {
      time: new Date().toISOString(),
      uptime: process.uptime(),
    }, 'Server is healthy');
  } catch (err) {
    return responseHelper.error(res, 'Health check failed');
  }
};
