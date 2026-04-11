import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  app.use(cors());
}

app.use(express.json({ limit: '10gb' }));
app.use(express.urlencoded({ extended: true, limit: '10gb' }));
app.use(express.raw({ type: ['image/*', 'video/*', 'application/octet-stream'], limit: '10gb' }));

app.use('/api', routes);

export default app;
