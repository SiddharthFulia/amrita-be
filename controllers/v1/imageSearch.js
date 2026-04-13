import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { searchImages } from '../../services/imageSearch.js';

const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

export const getImageSearch = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    const count = Math.min(parseInt(req.query.count || '20'), 40);

    if (!query) {
      return responseHelper.error(res, 'q parameter required', 400);
    }

    const cacheKey = `${query}-${count}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      logger.info(`IMAGE SEARCH CACHE HIT | "${query}"`);
      return responseHelper.success(res, { images: cached.images, query, cached: true }, 'Image search results');
    }

    logger.info(`IMAGE SEARCH | "${query}" | count=${count}`);
    const startTime = Date.now();
    const images = await searchImages(query, count);
    const responseTime = Date.now() - startTime;

    cache.set(cacheKey, { images, timestamp: Date.now() });

    // Clean old cache entries
    for (const [key, value] of cache) {
      if (Date.now() - value.timestamp > CACHE_DURATION) cache.delete(key);
    }

    logger.info(`IMAGE SEARCH RES | ${responseTime}ms | ${images.length} results`);
    return responseHelper.success(res, { images, query, cached: false }, 'Image search results');
  } catch (controllerError) {
    logger.error(`getImageSearch error: ${controllerError.message}`, { service: 'ImageSearchController' });
    return responseHelper.error(res, controllerError.message || 'Search failed');
  }
};
