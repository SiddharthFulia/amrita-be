import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(express.raw({ type: ['image/*', 'video/*', 'application/octet-stream'], limit: '500mb' }));

app.use('/api', routes);

export default app;
