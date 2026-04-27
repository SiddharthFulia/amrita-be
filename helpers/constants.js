import 'dotenv/config';

export const PORT = process.env.PORT || 4001;
export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
export const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
export const GOOGLE_OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
export const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
export const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
export const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5000';
export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const HF_TOKEN = process.env.HF_TOKEN;
export const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_KEY;
