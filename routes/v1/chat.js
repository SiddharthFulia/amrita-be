import { Router } from 'express';
import { postChat, getHealth } from '../../controllers/v1/chat.js';
import { getStats } from '../../controllers/v1/stats.js';
import { postAI } from '../../controllers/v1/ai.js';
import { postGroq } from '../../controllers/v1/groq.js';
import { postGemini, postAnalyzeImage } from '../../controllers/v1/gemini.js';
import { postImageGen, postImageEdit, postTTS, postSummarize } from '../../controllers/v1/hf.js';
import { postGenerate } from '../../controllers/v1/memoryGlitch.js';
import { postUpload } from '../../controllers/v1/upload.js';
import { getImageSearch } from '../../controllers/v1/imageSearch.js';
import { postTattooSave } from '../../controllers/v1/tattooSave.js';
import { postFaceAnalyze, getFaceHealth } from '../../controllers/v1/faceAnalyze.js';
import { postDetectObjects } from '../../controllers/v1/objectDetect.js';
import {
  getAuthUrl as spotifyAuthUrl, postExchange as spotifyExchange, getProfile as spotifyMe,
  getToken as spotifyToken, postLogout as spotifyLogout, getPlaylists as spotifyPlaylists,
  getSearch as spotifySearch, getNowPlaying as spotifyNowPlaying, getDevices as spotifyDevices,
  postPlay as spotifyPlay, postPause as spotifyPause, postNext as spotifyNext,
  postPrevious as spotifyPrevious, postVolume as spotifyVolume, postTransfer as spotifyTransfer,
  getPreview as spotifyPreview, getPlaylist as spotifyPlaylist, getAlbum as spotifyAlbum,
  getSavedTracks as spotifySavedTracks, putSavedTrack as spotifySaveTrack,
  deleteSavedTrack as spotifyUnsaveTrack, checkSavedTracks as spotifyCheckSaved,
  getTopTracks as spotifyTopTracks, getTopArtists as spotifyTopArtists,
  getRecentlyPlayed as spotifyRecentlyPlayed, getFeaturedPlaylists as spotifyFeatured,
  getNewReleases as spotifyNewReleases,
  postCreatePlaylist as spotifyCreatePlaylist, putUpdatePlaylist as spotifyUpdatePlaylist,
  postAddTracks as spotifyAddTracks, deletePlaylistTracks as spotifyRemoveTracks,
  deletePlaylistFollow as spotifyUnfollow, putPlaylistFollow as spotifyFollow,
} from '../../controllers/v1/spotify.js';

const router = Router();

router.post('/whisper', postChat);
router.post('/ai', postAI);
router.post('/groq', postGroq);
router.post('/gemini', postGemini);
router.post('/analyze-image', postAnalyzeImage);
router.post('/image-gen', postImageGen);
router.post('/image-edit', postImageEdit);
router.post('/tts', postTTS);
router.post('/summarize', postSummarize);
router.post('/memory-glitch/generate', postGenerate);
router.post('/upload', postUpload);
router.post('/tattoo-save', postTattooSave);
router.post('/face-analyze', postFaceAnalyze);
router.post('/detect-objects', postDetectObjects);
router.get('/face-health', getFaceHealth);
router.get('/health', getHealth);
router.get('/stats', getStats);
router.get('/image-search', getImageSearch);

// ─── Spotify (BE-managed OAuth + API proxy)
router.get('/spotify/auth-url', spotifyAuthUrl);
router.post('/spotify/exchange', spotifyExchange);
router.get('/spotify/me', spotifyMe);
router.get('/spotify/token', spotifyToken);
router.post('/spotify/logout', spotifyLogout);
router.get('/spotify/playlists', spotifyPlaylists);
router.get('/spotify/search', spotifySearch);
router.get('/spotify/now-playing', spotifyNowPlaying);
router.get('/spotify/devices', spotifyDevices);
router.post('/spotify/play', spotifyPlay);
router.post('/spotify/pause', spotifyPause);
router.post('/spotify/next', spotifyNext);
router.post('/spotify/previous', spotifyPrevious);
router.post('/spotify/volume', spotifyVolume);
router.post('/spotify/transfer', spotifyTransfer);
router.get('/spotify/preview/:trackId', spotifyPreview);
router.get('/spotify/playlist/:id', spotifyPlaylist);
router.get('/spotify/album/:id', spotifyAlbum);
router.get('/spotify/saved-tracks', spotifySavedTracks);
router.put('/spotify/saved-tracks/:id', spotifySaveTrack);
router.delete('/spotify/saved-tracks/:id', spotifyUnsaveTrack);
router.get('/spotify/saved-tracks/check', spotifyCheckSaved);
router.get('/spotify/top-tracks', spotifyTopTracks);
router.get('/spotify/top-artists', spotifyTopArtists);
router.get('/spotify/recently-played', spotifyRecentlyPlayed);
router.get('/spotify/featured-playlists', spotifyFeatured);
router.get('/spotify/new-releases', spotifyNewReleases);
router.post('/spotify/create-playlist', spotifyCreatePlaylist);
router.put('/spotify/playlist/:id', spotifyUpdatePlaylist);
router.post('/spotify/playlist/:id/tracks', spotifyAddTracks);
router.delete('/spotify/playlist/:id/tracks', spotifyRemoveTracks);
router.delete('/spotify/playlist/:id/follow', spotifyUnfollow);
router.put('/spotify/playlist/:id/follow', spotifyFollow);

export default router;
