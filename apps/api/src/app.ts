import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { attributesRouter } from './routes/attributes';
import { qualityRouter } from './routes/quality';
import { syncRouter } from './routes/sync';
import { aiRouter } from './routes/ai';
import { storeRouter } from './routes/store';
import { webhooksRouter } from './routes/webhooks';

export const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/attributes', attributesRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/sync', syncRouter);
app.use('/api/ai', aiRouter);
app.use('/api/store', storeRouter);
app.use('/api/webhooks', webhooksRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'catalogiq-api', timestamp: new Date().toISOString() });
});
