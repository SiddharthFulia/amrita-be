import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { uploadToDrive } from '../../services/upload.js';

export const postUpload = async (req, res) => {
  try {
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
    const fileName = decodeURIComponent(req.headers['x-file-name'] || `upload-${Date.now()}`);
    const folder = req.headers['x-folder'] || 'tinkerbell';
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    let fileBuffer;
    if (req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
      fileBuffer = req.body;
    } else {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return responseHelper.error(res, 'No file data received', 400);
    }

    logger.info(`UPLOAD REQ | ip=${clientIp} | file=${fileName} | folder=${folder} | type=${contentType} | size=${fileBuffer.length}`);

    const result = await uploadToDrive(fileBuffer, fileName, contentType, folder);

    logger.info(`UPLOAD RES | file=${result.name} | id=${result.id}`);
    return responseHelper.success(res, result, 'File uploaded');
  } catch (controllerError) {
    logger.error(`postUpload error: ${controllerError.message}`, { service: 'UploadController' });
    return responseHelper.error(res, controllerError.message || 'Upload failed');
  }
};
