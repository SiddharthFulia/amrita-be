import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { uploadToDrive } from '../../services/upload.js';

export const postUpload = async (req, res) => {
  try {
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const fileName = req.headers['x-file-name'] || `upload-${Date.now()}`;
    const folder = req.headers['x-folder'] || 'tinkerbell';

    logger.info(`UPLOAD REQ | ip=${clientIp} | file=${fileName} | folder=${folder} | size=${req.headers['content-length']}`);

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    const result = await uploadToDrive(fileBuffer, fileName, contentType, folder);

    logger.info(`UPLOAD RES | file=${result.name} | id=${result.id}`);
    return responseHelper.success(res, result, 'File uploaded');
  } catch (controllerError) {
    logger.error(`postUpload error: ${controllerError.message}`, { service: 'UploadController' });
    return responseHelper.error(res, controllerError.message || 'Upload failed');
  }
};
