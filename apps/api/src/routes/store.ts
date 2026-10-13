import { Router, Request, Response } from 'express';
import { db } from '../db/repository';
import { WooCommerceClient } from '../store/wooCommerceClient';
import { StoreConnectionConfigSchema, Product } from '@catalogiq/shared';

export const storeRouter = Router();

// GET /api/store/config
storeRouter.get('/config', (req: Request, res: Response) => {
  const cfg = db.getStoreConfig();
  // Mask consumer secret for security
  res.json({
    storeUrl: cfg.storeUrl,
    consumerKey: cfg.consumerKey ? cfg.consumerKey.slice(0, 8) + '...' : '',
    webhookSecret: cfg.webhookSecret ? 'configured' : '',
    mode: cfg.mode
  });
});

// POST /api/store/config
storeRouter.post('/config', (req: Request, res: Response) => {
  const current = db.getStoreConfig();
  const parsed = StoreConnectionConfigSchema.safeParse({
    ...current,
    ...req.body
  });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid configuration', details: parsed.error.issues });
  }

  const saved = db.saveStoreConfig(parsed.data);
  res.json({
    message: 'Store configuration saved successfully',
    mode: saved.mode,
    storeUrl: saved.storeUrl
  });
});

// POST /api/store/test
storeRouter.post('/test', async (req: Request, res: Response) => {
  const current = db.getStoreConfig();
  const storeUrl = req.body.storeUrl || current.storeUrl;
  const consumerKey = req.body.consumerKey || current.consumerKey;
  const consumerSecret = req.body.consumerSecret || current.consumerSecret;

  const client = new WooCommerceClient(storeUrl, consumerKey, consumerSecret);
  const result = await client.testConnection();

  if (result.success) {
    res.json({ success: true, message: 'Connected to WooCommerce successfully', details: result });
  } else {
    res.status(400).json({ success: false, error: result.error || 'Connection failed' });
  }
});

// POST /api/store/import
storeRouter.post('/import', async (req: Request, res: Response) => {
  const cfg = db.getStoreConfig();
  const client = new WooCommerceClient(cfg.storeUrl, cfg.consumerKey, cfg.consumerSecret);

  try {
    const wooProducts = await client.getProducts({ perPage: 100 });
    let createdCount = 0;
    let updatedCount = 0;

    for (const wp of wooProducts) {
      // De-duplicate: check by Woo ID first, then by SKU
      let existing = db.getProductByWooId(wp.id);
      if (!existing && wp.sku) {
        existing = db.getProductBySku(wp.sku);
      }

      const attributesMap: Record<string, string> = {};
      if (Array.isArray(wp.attributes)) {
        for (const attr of wp.attributes) {
          if (attr.name && attr.options && attr.options.length > 0) {
            attributesMap[attr.name.toLowerCase()] = attr.options[0];
          }
        }
      }

      const productPayload: Product = {
        id: existing ? existing.id : `prod-woo-${wp.id}`,
        wooId: wp.id,
        name: wp.name || 'Untitled Product',
        sku: wp.sku || `SKU-${wp.id}`,
        price: parseFloat(wp.regular_price || wp.price || '0'),
        description: wp.description || '',
        shortDescription: wp.short_description || '',
        categories: Array.isArray(wp.categories) ? wp.categories.map((c: any) => c.name) : [],
        images: Array.isArray(wp.images)
          ? wp.images.map((img: any, idx: number) => ({
              id: `img-${wp.id}-${idx}`,
              url: img.src,
              altText: img.alt || '',
              position: idx
            }))
          : [],
        variants: [],
        attributes: attributesMap,
        status: (wp.status as any) || 'publish',
        syncStatus: 'synced',
        qualityScore: 100,
        currentVersion: existing ? existing.currentVersion + 1 : 1,
        lastSyncedAt: new Date().toISOString(),
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existing) {
        db.saveProduct(productPayload, `Imported update from WooCommerce ID #${wp.id}`);
        updatedCount++;
      } else {
        db.saveProduct(productPayload, `Imported from WooCommerce ID #${wp.id}`);
        createdCount++;
      }
    }

    res.json({
      message: `Import complete: ${createdCount} imported, ${updatedCount} updated (0 duplicates).`,
      createdCount,
      updatedCount,
      totalImported: wooProducts.length
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Import failed', message: err.message });
  }
});
