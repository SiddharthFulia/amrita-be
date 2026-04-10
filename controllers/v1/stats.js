import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { getServerStats } from '../../services/stats.js';

export const getStats = async (req, res) => {
  try {
    const serverStats = await getServerStats();
    return responseHelper.success(res, serverStats, 'Stats retrieved');
  } catch (error) {
    logger.error(`getStats error: ${error.message}`, { service: 'StatsController' });
    return responseHelper.error(res, 'Failed to get stats');
  }
};
