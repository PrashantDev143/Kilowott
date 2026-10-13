import { Router, Request, Response } from 'express';
import { db } from '../db/repository';
import { evaluateQuality } from '../domain/quality/rules';
import { ProductSchema, Product } from '@catalogiq/shared';

export const productsRouter = Router();

// GET /api/products
productsRouter.get('/', (req: Request, res: Response) => {
  const { search, qualityBand, syncStatus, category, sort = 'name', order = 'asc' } = req.query;

  let products = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();

  // Evaluate quality on all products to ensure up-to-date scores
  products = products.map(p => {
    const q = evaluateQuality(p, { allProducts: products, attributes: attrs, productTypes: types });
    return {
      ...p,
      qualityScore: q.score
    };
  });

  // Filter: search
  if (search) {
    const s = String(search).toLowerCase();
    products = products.filter(
      p =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s)
    );
  }

  // Filter: syncStatus
  if (syncStatus && syncStatus !== 'all') {
    products = products.filter(p => p.syncStatus === syncStatus);
  }

  // Filter: category
  if (category && category !== 'all') {
    products = products.filter(p => p.categories.includes(String(category)));
  }

  // Filter: qualityBand
  if (qualityBand && qualityBand !== 'all') {
    products = products.filter(p => {
      if (qualityBand === 'Healthy') return p.qualityScore >= 90;
      if (qualityBand === 'Needs work') return p.qualityScore >= 70 && p.qualityScore < 90;
      if (qualityBand === 'Poor') return p.qualityScore < 70;
      return true;
    });
  }

  // Sorting
  products.sort((a, b) => {
    let valA: any = a[sort as keyof Product] ?? '';
    let valB: any = b[sort as keyof Product] ?? '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  res.json({
    total: products.length,
    products
  });
});

// GET /api/products/:id
productsRouter.get('/:id', (req: Request, res: Response) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();
  const quality = evaluateQuality(product, { allProducts: all, attributes: attrs, productTypes: types });

  res.json({
    product: {
      ...product,
      qualityScore: quality.score
    },
    quality
  });
});

// POST /api/products
productsRouter.post('/', (req: Request, res: Response) => {
  const parsed = ProductSchema.safeParse({
    id: `prod-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product payload', details: parsed.error.issues });
  }

  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();
  const q = evaluateQuality(parsed.data, { allProducts: all, attributes: attrs, productTypes: types });

  const toSave: Product = {
    ...parsed.data,
    qualityScore: q.score
  };

  const created = db.saveProduct(toSave, 'Created product');
  res.status(201).json(created);
});

// PUT /api/products/:id
productsRouter.put('/:id', (req: Request, res: Response) => {
  const existing = db.getProductById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const body = req.body;
  const merged: Product = {
    ...existing,
    ...body,
    id: existing.id,
    // If synced and modified, revert syncStatus to 'draft' as specified in PRD state machine
    syncStatus: existing.syncStatus === 'synced' ? 'draft' : (body.syncStatus || existing.syncStatus),
    updatedAt: new Date().toISOString()
  };

  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();
  const q = evaluateQuality(merged, { allProducts: all, attributes: attrs, productTypes: types });
  merged.qualityScore = q.score;

  const summary = body.changeSummary || 'Updated product fields';
  const updated = db.saveProduct(merged, summary);

  res.json({ product: updated, quality: q });
});

// DELETE /api/products/:id
productsRouter.delete('/:id', (req: Request, res: Response) => {
  const ok = db.deleteProduct(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ success: true });
});

// GET /api/products/:id/versions
productsRouter.get('/:id/versions', (req: Request, res: Response) => {
  const versions = db.getProductVersions(req.params.id);
  res.json(versions);
});

// POST /api/products/:id/restore-version/:versionNumber
productsRouter.post('/:id/restore-version/:versionNumber', (req: Request, res: Response) => {
  const versionNum = parseInt(req.params.versionNumber, 10);
  const versions = db.getProductVersions(req.params.id);
  const targetVersion = versions.find(v => v.versionNumber === versionNum);

  if (!targetVersion) {
    return res.status(404).json({ error: 'Version not found' });
  }

  const restored = db.saveProduct(
    {
      ...targetVersion.snapshot,
      syncStatus: 'draft',
      updatedAt: new Date().toISOString()
    },
    `Restored from version #${versionNum}`
  );

  res.json({ message: `Successfully restored version #${versionNum}`, product: restored });
});
