import { logger } from '../helpers/logger.js';

const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getAccessToken() {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      refresh_token: OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenResponse.ok) throw new Error('Failed to get access token');
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function findOrCreateFolder(accessToken, folderName) {
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${DRIVE_FOLDER_ID}'+in+parents+and+name='${folderName}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchResponse.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_FOLDER_ID] }),
  });
  const createData = await createResponse.json();
  return createData.id;
}

export async function uploadToDrive(fileBuffer, fileName, contentType, folderName = 'tinkerbell') {
  const accessToken = await getAccessToken();

  const parentFolderId = folderName === 'gallery'
    ? DRIVE_FOLDER_ID
    : await findOrCreateFolder(accessToken, folderName);

  const metadata = JSON.stringify({ name: fileName, parents: [parentFolderId] });

  const boundary = '-----BOUNDARY' + Date.now();
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  ];

  const bodyStart = Buffer.from(bodyParts[0] + bodyParts[1].split('\r\n\r\n')[0] + '\r\n\r\n', 'utf-8');

  const startBuffer = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`);
  const endBuffer = Buffer.from(`\r\n--${boundary}--`);
  const multipartBody = Buffer.concat([startBuffer, fileBuffer, endBuffer]);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Drive upload failed: ${errorText}`);
  }

  const uploadedFile = await uploadResponse.json();

  await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  logger.info('Uploaded to Drive', { fileId: uploadedFile.id, fileName: uploadedFile.name, folder: folderName });

  return {
    id: uploadedFile.id,
    name: uploadedFile.name,
    mimeType: uploadedFile.mimeType,
    createdTime: uploadedFile.createdTime,
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${uploadedFile.id}=s400`,
    fullUrl: uploadedFile.mimeType?.startsWith('video/')
      ? `https://drive.google.com/file/d/${uploadedFile.id}/preview`
      : `https://lh3.googleusercontent.com/d/${uploadedFile.id}=s1600`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${uploadedFile.id}`,
  };
}
