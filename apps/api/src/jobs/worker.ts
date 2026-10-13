import { db } from '../db/repository';
import { WooCommerceClient, redactSecrets } from '../store/wooCommerceClient';
import { assertTransition } from '../sync/stateMachine';
import { evaluateRetry } from '../sync/backoff';
import { verifyReadBack } from '../sync/readBack';
import { SyncJob, Product } from '@catalogiq/shared';

export class SyncWorker {
  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  start(pollIntervalMs = 2000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[SyncWorker] Started database-backed sync worker loop.');

    this.intervalTimer = setInterval(async () => {
      try {
        await this.processPendingJobs();
      } catch (err) {
        console.error('[SyncWorker] Error during worker loop iteration:', err);
      }
    }, pollIntervalMs);
  }

  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
  }

  private getClient(): WooCommerceClient {
    const cfg = db.getStoreConfig();
    const key = cfg.consumerKey || process.env.WOO_CONSUMER_KEY || '';
    const secret = cfg.consumerSecret || process.env.WOO_CONSUMER_SECRET || '';
    return new WooCommerceClient(cfg.storeUrl, key, secret);
  }

  async processPendingJobs(): Promise<void> {
    const pendingJobs = db.getPendingSyncJobs();
    if (pendingJobs.length === 0) return;

    for (const job of pendingJobs) {
      await this.executeJob(job);
    }
  }

  async executeJob(job: SyncJob): Promise<void> {
    const product = db.getProductById(job.productId);
    if (!product) {
      job.status = 'failed';
      job.error = `Product ${job.productId} no longer exists in PIM database.`;
      db.saveSyncJob(job);
      return;
    }

    const client = this.getClient();

    // Transition state to 'syncing'
    job.status = 'syncing';
    job.attempts++;
    job.updatedAt = new Date().toISOString();
    db.saveSyncJob(job);

    try {
      assertTransition(product.syncStatus, 'syncing');
      product.syncStatus = 'syncing';
      db.saveProduct(product, 'Sync in progress');
    } catch (e) {
      // Ignore if already syncing or retrying
    }

    let storeResult: any = null;
    const attempt = job.attempts;

    try {
      // DUPLICATE PREVENTION:
      // If product has no wooId, look up by SKU in the store first before attempting create!
      if (!product.wooId) {
        const existingInStore = await client.findProductBySku(product.sku);
        if (existingInStore && existingInStore.id) {
          product.wooId = existingInStore.id;
          console.log(`[SyncWorker] Located existing store item for SKU ${product.sku} -> Woo ID #${product.wooId}`);
        }
      }

      // Format payload for WooCommerce REST API
      const wooPayload: any = {
        name: product.name,
        sku: product.sku,
        regular_price: String(product.price),
        description: product.description,
        short_description: product.shortDescription,
        categories: product.categories.map(c => ({ name: c })),
        images: product.images.map(img => ({ src: img.url, alt: img.altText })),
        status: product.status || 'publish',
        attributes: Object.entries(product.attributes).map(([key, val]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          options: [String(val)],
          visible: true
        }))
      };

      try {
        if (product.wooId) {
          // Update existing store product
          storeResult = await client.updateProduct(product.wooId, wooPayload);
        } else {
          // Create new store product
          storeResult = await client.createProduct(wooPayload);
          product.wooId = storeResult.id;
        }
      } catch (uploadErr: any) {
        if (uploadErr.message && uploadErr.message.includes('Invalid image') && wooPayload.images?.length > 0) {
          console.warn(`[SyncWorker] Image upload rejected by store for ${product.sku}, retrying without images...`);
          wooPayload.images = [];
          if (product.wooId) {
            storeResult = await client.updateProduct(product.wooId, wooPayload);
          } else {
            storeResult = await client.createProduct(wooPayload);
            product.wooId = storeResult.id;
          }
        } else {
          throw uploadErr;
        }
      }

      // READ-BACK VERIFICATION
      const readBackData = await client.getProduct(product.wooId!);
      const verification = verifyReadBack(product, readBackData);

      if (!verification.matches) {
        throw new Error(`Read-back verification failed: ${verification.differences.join('; ')}`);
      }

      // Success! Transition product to 'synced'
      product.syncStatus = 'synced';
      product.lastSyncedAt = new Date().toISOString();
      product.lastSyncError = null;
      db.saveProduct(product, 'Published and confirmed by WooCommerce');

      job.status = 'completed';
      job.error = null;
      job.updatedAt = new Date().toISOString();
      db.saveSyncJob(job);

      db.addSyncLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        jobId: job.id,
        productId: product.id,
        action: product.wooId ? 'update' : 'create',
        attempt,
        requestSummary: `Synced ${product.sku} (${product.name})`,
        responseStatus: 200,
        responseSummary: `Read-back confirmed in WooCommerce (ID #${product.wooId})`,
        isSuccess: true,
        createdAt: new Date().toISOString()
      });

      console.log(`[SyncWorker] Successfully synced product ${product.sku} (Woo ID #${product.wooId})`);
    } catch (err: any) {
      console.warn(`[SyncWorker] Publish attempt ${attempt} failed for ${product.sku}:`, err.message);

      const decision = evaluateRetry(attempt, job.maxAttempts, err);

      const causeCode = err.cause?.code || (typeof err.cause === 'string' ? err.cause : null);
      const causeMessage = err.cause?.message || (err.cause && typeof err.cause !== 'object' ? String(err.cause) : null);

      const storeConfig = db.getStoreConfig();
      const secrets = [storeConfig.consumerKey, storeConfig.consumerSecret];

      const safeMessage = redactSecrets(err.message || 'Unknown sync error', secrets);
      const safeCauseMessage = causeMessage ? redactSecrets(causeMessage, secrets) : null;

      let detailedSummary = safeMessage;
      if (safeCauseMessage) {
        detailedSummary += ` (${causeCode ? `[${causeCode}] ` : ''}${safeCauseMessage})`;
      }

      db.addSyncLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        jobId: job.id,
        productId: product.id,
        action: 'publish',
        attempt,
        requestSummary: redactSecrets(`Publish ${product.sku}`, secrets),
        responseStatus: err.status || 500,
        responseSummary: detailedSummary,
        errorCauseCode: causeCode || null,
        errorCauseMessage: safeCauseMessage,
        isSuccess: false,
        createdAt: new Date().toISOString()
      });

      if (decision.isRetryable) {
        job.status = 'retrying';
        job.nextRetryAt = new Date(Date.now() + decision.delayMs).toISOString();
        job.error = `${decision.reason}: ${detailedSummary} - Retrying at ${job.nextRetryAt}`;
        db.saveSyncJob(job);

        product.syncStatus = 'pending';
        product.lastSyncError = job.error;
        db.saveProduct(product, 'Sync failed (scheduled for retry)');
      } else {
        job.status = 'failed';
        job.error = detailedSummary;
        db.saveSyncJob(job);

        product.syncStatus = 'failed';
        product.lastSyncError = job.error;
        db.saveProduct(product, `Sync failed: ${job.error}`);
      }
    }
  }
}

export const syncWorker = new SyncWorker();
