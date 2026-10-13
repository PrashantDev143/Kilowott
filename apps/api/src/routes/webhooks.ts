import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/repository';

export const webhooksRouter = Router();

// Track processed webhook delivery IDs to guarantee idempotency
const processedDeliveries = new Set<string>();

webhooksRouter.post('/woocommerce', (req: Request, res: Response) => {
  const deliveryId = (req.headers['x-wc-webhook-delivery-id'] as string) || `del-${Date.now()}`;
  const signature = req.headers['x-wc-webhook-signature'] as string;
  const topic = (req.headers['x-wc-webhook-topic'] as string) || 'product.updated';

  // 1. De-duplication check
  if (processedDeliveries.has(deliveryId)) {
    console.log(`[Webhook] Duplicate delivery ignored: ${deliveryId}`);
    return res.status(200).json({ status: 'ignored', reason: 'Duplicate delivery ID' });
  }
  processedDeliveries.add(deliveryId);

  // 2. Signature verification (if secret is configured)
  const cfg = db.getStoreConfig();
  if (cfg.webhookSecret && signature) {
    const rawBody = JSON.stringify(req.body);
    const expectedSig = crypto
      .createHmac('sha256', cfg.webhookSecret)
      .update(rawBody)
      .digest('base64');

    if (expectedSig !== signature) {
      console.warn('[Webhook] Invalid signature received!');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  const payload = req.body;
  const wooId = payload?.id;

  if (wooId) {
    const existing = db.getProductByWooId(wooId);
    if (existing) {
      // CONFLICT DETECTION:
      // If PIM has unsynced local changes (e.g. status is 'draft' or 'pending'), mark as CONFLICT
      if (existing.syncStatus === 'draft' || existing.syncStatus === 'pending') {
        console.warn(`[Webhook] Conflict detected on product #${existing.id} (Woo #${wooId})!`);
        existing.syncStatus = 'conflict';
        existing.conflictDetails = `Store edited product '${payload.name}' at ${new Date().toISOString()} while local PIM draft exists.`;
        db.saveProduct(existing, 'Conflict flagged by store webhook update');
      } else {
        // Sync cleanly
        existing.name = payload.name || existing.name;
        existing.price = parseFloat(payload.regular_price || payload.price || existing.price);
        existing.syncStatus = 'synced';
        existing.lastSyncedAt = new Date().toISOString();
        db.saveProduct(existing, 'Updated via WooCommerce webhook');
      }
    }
  }

  res.status(200).json({ status: 'success', deliveryId });
});
