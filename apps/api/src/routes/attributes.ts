import { Router, Request, Response } from 'express';
import { db } from '../db/repository';
import { AttributeDefinitionSchema, ProductTypeSchema } from '@catalogiq/shared';
import { generateVariationMatrix } from '../domain/attributes/builder';

export const attributesRouter = Router();

// GET /api/attributes
attributesRouter.get('/', (req: Request, res: Response) => {
  res.json({
    attributes: db.getAttributes(),
    productTypes: db.getProductTypes()
  });
});

// POST /api/attributes
attributesRouter.post('/', (req: Request, res: Response) => {
  const parsed = AttributeDefinitionSchema.safeParse({
    id: `attr-${Date.now()}`,
    ...req.body
  });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid attribute payload', details: parsed.error.issues });
  }

  const saved = db.saveAttribute(parsed.data);
  res.status(201).json(saved);
});

// DELETE /api/attributes/:id
attributesRouter.delete('/:id', (req: Request, res: Response) => {
  db.deleteAttribute(req.params.id);
  res.json({ success: true });
});

// POST /api/attributes/product-types
attributesRouter.post('/product-types', (req: Request, res: Response) => {
  const parsed = ProductTypeSchema.safeParse({
    id: `ptype-${Date.now()}`,
    ...req.body
  });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product type payload', details: parsed.error.issues });
  }

  const saved = db.saveProductType(parsed.data);
  res.status(201).json(saved);
});

// DELETE /api/attributes/product-types/:id
attributesRouter.delete('/product-types/:id', (req: Request, res: Response) => {
  db.deleteProductType(req.params.id);
  res.json({ success: true });
});

// POST /api/attributes/generate-variations
attributesRouter.post('/generate-variations', (req: Request, res: Response) => {
  const { productId, baseSku, basePrice, options } = req.body;
  if (!productId || !baseSku || !basePrice || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Missing required parameters for variation generation' });
  }

  const variations = generateVariationMatrix(productId, baseSku, Number(basePrice), options);
  res.json({ variations });
});
