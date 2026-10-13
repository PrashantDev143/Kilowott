import { Router, Request, Response } from 'express';
import { db } from '../db/repository';
import { evaluateQuality } from '../domain/quality/rules';
import { assertTransition } from '../sync/stateMachine';
import { syncWorker } from '../jobs/worker';
import { SyncJob } from '@catalogiq/shared';

export const syncRouter = Router();

// POST /api/sync/publish/:productId
syncRouter.post('/publish/:productId', async (req: Request, res: Response) => {
  const product = db.getProductById(req.params.productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check critical quality violations before publish
  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();
  const quality = evaluateQuality(product, { allProducts: all, attributes: attrs, productTypes: types });
  const hasCritical = quality.violations.some(v => v.severity === 'Critical');

  if (hasCritical) {
    return res.status(400).json({
      error: 'Publish blocked: Product has critical quality violations.',
      violations: quality.violations.filter(v => v.severity === 'Critical')
    });
  }

  try {
    assertTransition(product.syncStatus, 'pending');
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  // Idempotency key: hash of product ID + currentVersion
  const idempotencyKey = `idemp-${product.id}-v${product.currentVersion}`;

  const job: SyncJob = {
    id: `job-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    productId: product.id,
    operation: product.wooId ? 'update' : 'create',
    status: 'pending',
    attempts: 0,
    maxAttempts: 5,
    idempotencyKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveSyncJob(job);

  product.syncStatus = 'pending';
  product.lastSyncError = null;
  db.saveProduct(product, 'Queued for WooCommerce publish');

  // Trigger worker processing immediately
  syncWorker.processPendingJobs().catch(e => console.error(e));

  res.json({
    message: 'Publish job queued successfully',
    job,
    product
  });
});

// POST /api/sync/publish-batch
syncRouter.post('/publish-batch', async (req: Request, res: Response) => {
  const { productIds } = req.body;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds array is required' });
  }

  const results: Array<{ productId: string; queued: boolean; reason?: string }> = [];
  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();

  for (const id of productIds) {
    const product = db.getProductById(id);
    if (!product) {
      results.push({ productId: id, queued: false, reason: 'Product not found' });
      continue;
    }

    const quality = evaluateQuality(product, { allProducts: all, attributes: attrs, productTypes: types });
    const hasCritical = quality.violations.some(v => v.severity === 'Critical');
    if (hasCritical) {
      results.push({ productId: id, queued: false, reason: 'Has critical quality violations' });
      continue;
    }

    const idempotencyKey = `idemp-${product.id}-v${product.currentVersion}`;
    const job: SyncJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      productId: product.id,
      operation: product.wooId ? 'update' : 'create',
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveSyncJob(job);
    product.syncStatus = 'pending';
    db.saveProduct(product, 'Batch queued for publish');
    results.push({ productId: id, queued: true });
  }

  syncWorker.processPendingJobs().catch(e => console.error(e));

  res.json({
    message: `Processed ${results.length} products for publishing`,
    results
  });
});

// GET /api/sync/jobs
syncRouter.get('/jobs', (req: Request, res: Response) => {
  const jobs = db.getSyncJobs();
  res.json(jobs);
});

// POST /api/sync/retry/:jobId
syncRouter.post('/retry/:jobId', async (req: Request, res: Response) => {
  const job = db.getSyncJobById(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Sync job not found' });
  }

  job.status = 'pending';
  job.attempts = 0;
  job.error = null;
  job.nextRetryAt = null;
  job.updatedAt = new Date().toISOString();
  db.saveSyncJob(job);

  const product = db.getProductById(job.productId);
  if (product) {
    product.syncStatus = 'pending';
    db.saveProduct(product, 'Manually retried sync');
  }

  syncWorker.processPendingJobs().catch(e => console.error(e));

  res.json({ message: 'Job scheduled for retry', job });
});

// GET /api/sync/logs
syncRouter.get('/logs', (req: Request, res: Response) => {
  const { productId } = req.query;
  const logs = db.getSyncLogs(productId ? String(productId) : undefined);
  res.json(logs);
});
