import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.MOCK_WOO_PORT || 5050;

app.use(cors());
app.use(express.json());

// In-memory store state
interface WooProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: string;
  regular_price: string;
  description: string;
  short_description: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  attributes: Array<{ id?: number; name: string; options: string[]; visible?: boolean; variation?: boolean }>;
  meta_data?: Array<{ key: string; value: any }>;
  status: string;
  type: string;
  date_created: string;
  date_modified: string;
}

interface WooVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  attributes: Array<{ name: string; option: string }>;
  meta_data?: Array<{ key: string; value: any }>;
  image?: { src: string; alt: string };
}

let nextId = 101;
let nextVarId = 1001;
const products: Map<number, WooProduct> = new Map();
const variations: Map<number, WooVariation[]> = new Map(); // parentId -> variations
const categories: Array<{ id: number; name: string; slug: string; description: string }> = [];
const globalAttributes: Array<{ id: number; name: string; slug: string; type: string }> = [];

// Failure injection simulation settings
interface MockFailures {
  failNextRequests: number;
  failureType: 'timeout' | 'rate_limit' | 'server_error' | 'validation_error' | 'none';
  customStatusCode: number;
  customMessage: string;
  simulatedDelayMs: number;
}

let failureConfig: MockFailures = {
  failNextRequests: 0,
  failureType: 'none',
  customStatusCode: 500,
  customMessage: 'Simulated WooCommerce server error',
  simulatedDelayMs: 0
};

function findCatalogPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'seed/catalog.json'),
    path.resolve(__dirname, '../../seed/catalog.json'),
    path.resolve(__dirname, '../../../seed/catalog.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

// Seed store from canonical seed/catalog.json
function seedInitialStore() {
  products.clear();
  variations.clear();
  categories.length = 0;
  globalAttributes.length = 0;

  const catalogFile = findCatalogPath();
  if (fs.existsSync(catalogFile)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));

      // Categories
      let catIdCounter = 1;
      for (const c of catalog.categories || []) {
        categories.push({
          id: c.id || catIdCounter++,
          name: c.name,
          slug: c.slug,
          description: c.description || ''
        });
      }

      // Global Attributes
      let attrIdCounter = 1;
      for (const a of catalog.attributes || []) {
        globalAttributes.push({
          id: a.id || attrIdCounter++,
          name: a.name,
          slug: a.slug,
          type: a.type || 'select'
        });
      }

      // Products (Skip secondary duplicate SKU product to mirror live WooCommerce behavior)
      const seenSkus = new Set<string>();
      let pIdCounter = 101;

      for (const p of catalog.products || []) {
        if (seenSkus.has(p.sku) || p.defect_tags?.includes('local_draft_only')) {
          // WooCommerce rejects duplicate SKUs; only first product exists in store
          continue;
        }
        seenSkus.add(p.sku);

        const currentId = pIdCounter++;
        const wooProd: WooProduct = {
          id: currentId,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          price: String(p.price || p.regular_price || '0'),
          regular_price: String(p.regular_price || p.price || '0'),
          description: p.description || '',
          short_description: p.short_description || '',
          categories: (p.categories || []).map((cat: any, idx: number) => ({
            id: idx + 1,
            name: cat.name || cat,
            slug: cat.slug || (typeof cat === 'string' ? cat.toLowerCase() : '')
          })),
          images: (p.images || []).map((img: any, idx: number) => ({
            id: idx + 1,
            src: img.src,
            alt: img.alt || p.name
          })),
          attributes: (p.attributes || []).map((attr: any) => ({
            name: attr.name,
            options: attr.options || [],
            visible: attr.visible !== false,
            variation: attr.variation === true
          })),
          meta_data: [
            { key: '_catalogiq_seed', value: '1' },
            { key: '_catalogiq_seed_id', value: p.id },
            { key: '_catalogiq_clean', value: p.is_clean ? '1' : '0' }
          ],
          status: p.status || 'publish',
          type: p.type || 'simple',
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString()
        };

        products.set(currentId, wooProd);

        // Variations
        if (p.type === 'variable' && Array.isArray(p.variations)) {
          const varList: WooVariation[] = [];
          for (const v of p.variations) {
            varList.push({
              id: nextVarId++,
              sku: v.sku,
              price: String(v.price || v.regular_price),
              regular_price: String(v.regular_price || v.price),
              attributes: v.attributes || [],
              meta_data: [{ key: '_catalogiq_seed', value: '1' }],
              image: v.image
            });
          }
          variations.set(currentId, varList);
        }
      }
      nextId = pIdCounter;
      console.log(`[Mock Woo] Successfully loaded ${products.size} products from canonical catalog (${catalogFile}).`);
      return;
    } catch (err: any) {
      console.warn(`[Mock Woo] Could not load canonical catalog: ${err.message}. Using fallback seed.`);
    }
  }

  // Fallback seed
  const fallback = {
    id: 101,
    name: 'Classic Oxford Cotton Shirt',
    slug: 'classic-oxford-cotton-shirt',
    sku: 'SHIRT-OXF-001',
    price: '49.99',
    regular_price: '49.99',
    description: '100% premium cotton Oxford shirt.',
    short_description: 'Oxford shirt.',
    categories: [{ id: 1, name: 'Shirts', slug: 'shirts' }],
    images: [{ id: 1, src: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600', alt: 'Shirt' }],
    attributes: [{ name: 'Material', options: ['Cotton'] }],
    status: 'publish',
    type: 'simple',
    date_created: new Date().toISOString(),
    date_modified: new Date().toISOString()
  };
  products.set(101, fallback);
}

seedInitialStore();

// Middleware: Failure Injection Interceptor
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/mock-control')) {
    return next();
  }

  if (failureConfig.simulatedDelayMs > 0) {
    setTimeout(proceed, failureConfig.simulatedDelayMs);
  } else {
    proceed();
  }

  function proceed() {
    if (failureConfig.failNextRequests > 0) {
      failureConfig.failNextRequests--;
      console.log(`[Mock Woo] Injecting failure: ${failureConfig.failureType} (${failureConfig.failNextRequests} remaining)`);

      switch (failureConfig.failureType) {
        case 'timeout':
          return setTimeout(() => {
            res.status(504).json({ code: 'woocommerce_rest_timeout', message: 'Gateway Timeout' });
          }, 15000);

        case 'rate_limit':
          res.setHeader('Retry-After', '2');
          return res.status(429).json({
            code: 'woocommerce_rest_rate_limit_exceeded',
            message: 'Too many requests. Please slow down.'
          });

        case 'validation_error':
          return res.status(400).json({
            code: 'woocommerce_rest_invalid_sku',
            message: 'Invalid or duplicate SKU specified.'
          });

        case 'server_error':
        default:
          return res.status(failureConfig.customStatusCode || 500).json({
            code: 'woocommerce_rest_error',
            message: failureConfig.customMessage || 'Simulated internal server error'
          });
      }
    }
    next();
  }
});

// Control API
app.get('/api/mock-control/status', (req: Request, res: Response) => {
  res.json({
    activeConfig: failureConfig,
    productCount: products.size
  });
});

app.post('/api/mock-control/configure', (req: Request, res: Response) => {
  failureConfig = { ...failureConfig, ...req.body };
  res.json({
    message: 'Mock failure config updated successfully',
    config: failureConfig
  });
});

app.post('/api/mock-control/reset', (req: Request, res: Response) => {
  failureConfig = {
    failNextRequests: 0,
    failureType: 'none',
    customStatusCode: 500,
    customMessage: 'Simulated WooCommerce server error',
    simulatedDelayMs: 0
  };
  seedInitialStore();
  res.json({ message: 'Mock store reset to canonical catalog' });
});

// ==========================================
// WooCommerce REST API v3 Endpoints
// ==========================================

// System Status
app.get('/wp-json/wc/v3/system_status', (req: Request, res: Response) => {
  res.json({
    environment: {
      version: '11.2.1',
      wp_version: '6.5.2',
      server_info: 'Mock WooCommerce Express Server',
      database_version: '10.5.15'
    }
  });
});

// Categories
app.get('/wp-json/wc/v3/products/categories', (req: Request, res: Response) => {
  res.json(categories);
});

app.post('/wp-json/wc/v3/products/categories', (req: Request, res: Response) => {
  const newCat = {
    id: categories.length + 1,
    name: req.body.name,
    slug: req.body.slug || req.body.name.toLowerCase().replace(/\s+/g, '-'),
    description: req.body.description || ''
  };
  categories.push(newCat);
  res.status(201).json(newCat);
});

// Attributes
app.get('/wp-json/wc/v3/products/attributes', (req: Request, res: Response) => {
  res.json(globalAttributes);
});

app.post('/wp-json/wc/v3/products/attributes', (req: Request, res: Response) => {
  const newAttr = {
    id: globalAttributes.length + 1,
    name: req.body.name,
    slug: req.body.slug || req.body.name.toLowerCase(),
    type: req.body.type || 'select'
  };
  globalAttributes.push(newAttr);
  res.status(201).json(newAttr);
});

// Query Products
app.get('/wp-json/wc/v3/products', (req: Request, res: Response) => {
  const { sku, per_page = '100', page = '1' } = req.query;
  let items = Array.from(products.values());

  if (sku) {
    items = items.filter(p => p.sku === String(sku));
  }

  const limit = parseInt(String(per_page), 10);
  const offset = (parseInt(String(page), 10) - 1) * limit;
  const paginated = items.slice(offset, offset + limit);

  res.setHeader('X-WP-Total', items.length.toString());
  res.setHeader('X-WP-TotalPages', Math.ceil(items.length / limit).toString());
  res.json(paginated);
});

// Get Single Product
app.get('/wp-json/wc/v3/products/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const product = products.get(id);
  if (!product) {
    return res.status(404).json({
      code: 'woocommerce_rest_product_invalid_id',
      message: 'Invalid product ID.'
    });
  }
  res.json(product);
});

// Create Product
app.post('/wp-json/wc/v3/products', (req: Request, res: Response) => {
  const body = req.body;

  if (body.sku) {
    for (const p of products.values()) {
      if (p.sku === body.sku) {
        return res.status(400).json({
          code: 'product_invalid_sku',
          message: `Product SKU already exists in WooCommerce: ${body.sku}`
        });
      }
    }
  }

  const id = nextId++;
  const newProduct: WooProduct = {
    id,
    name: body.name || 'Untitled Product',
    slug: body.slug || (body.name ? body.name.toLowerCase().replace(/\s+/g, '-') : `product-${id}`),
    sku: body.sku || `SKU-${id}`,
    price: String(body.regular_price || body.price || '0'),
    regular_price: String(body.regular_price || body.price || '0'),
    description: body.description || '',
    short_description: body.short_description || '',
    categories: body.categories || [],
    images: body.images || [],
    attributes: body.attributes || [],
    meta_data: body.meta_data || [{ key: '_catalogiq_seed', value: '1' }],
    status: body.status || 'publish',
    type: body.type || 'simple',
    date_created: new Date().toISOString(),
    date_modified: new Date().toISOString()
  };

  products.set(id, newProduct);
  res.status(201).json(newProduct);
});

// Update Product
app.put('/wp-json/wc/v3/products/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = products.get(id);
  if (!existing) {
    return res.status(404).json({
      code: 'woocommerce_rest_product_invalid_id',
      message: 'Invalid product ID.'
    });
  }

  const body = req.body;
  const updated: WooProduct = {
    ...existing,
    ...body,
    id,
    date_modified: new Date().toISOString()
  };

  products.set(id, updated);
  res.json(updated);
});

// Delete Product
app.delete('/wp-json/wc/v3/products/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = products.get(id);
  if (!existing) {
    return res.status(404).json({
      code: 'woocommerce_rest_product_invalid_id',
      message: 'Invalid product ID.'
    });
  }
  products.delete(id);
  variations.delete(id);
  res.json(existing);
});

// Variations Endpoints
app.get('/wp-json/wc/v3/products/:id/variations', (req: Request, res: Response) => {
  const parentId = parseInt(req.params.id, 10);
  const vars = variations.get(parentId) || [];
  res.json(vars);
});

app.post('/wp-json/wc/v3/products/:id/variations/batch', (req: Request, res: Response) => {
  const parentId = parseInt(req.params.id, 10);
  const { create = [], update = [] } = req.body;
  let varList = variations.get(parentId) || [];

  const createdRes: WooVariation[] = [];
  const updatedRes: WooVariation[] = [];

  for (const c of create) {
    const v: WooVariation = {
      id: nextVarId++,
      sku: c.sku,
      price: String(c.regular_price || c.price || '0'),
      regular_price: String(c.regular_price || c.price || '0'),
      attributes: c.attributes || [],
      meta_data: c.meta_data || [{ key: '_catalogiq_seed', value: '1' }]
    };
    varList.push(v);
    createdRes.push(v);
  }

  for (const u of update) {
    const idx = varList.findIndex(v => v.id === u.id || v.sku === u.sku);
    if (idx >= 0) {
      varList[idx] = { ...varList[idx], ...u };
      updatedRes.push(varList[idx]);
    }
  }

  variations.set(parentId, varList);
  res.json({ create: createdRes, update: updatedRes, delete: [] });
});

// Product Batch Operations
app.post('/wp-json/wc/v3/products/batch', (req: Request, res: Response) => {
  const { create = [], update = [], delete: toDelete = [] } = req.body;
  const createdRes: WooProduct[] = [];
  const updatedRes: WooProduct[] = [];
  const deletedRes: WooProduct[] = [];

  for (const c of create) {
    const id = nextId++;
    const p: WooProduct = {
      id,
      name: c.name || 'Product',
      slug: `product-${id}`,
      sku: c.sku || `SKU-${id}`,
      price: String(c.regular_price || c.price || '0'),
      regular_price: String(c.regular_price || c.price || '0'),
      description: c.description || '',
      short_description: c.short_description || '',
      categories: c.categories || [],
      images: c.images || [],
      attributes: c.attributes || [],
      meta_data: c.meta_data || [{ key: '_catalogiq_seed', value: '1' }],
      status: c.status || 'publish',
      type: c.type || 'simple',
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString()
    };
    products.set(id, p);
    createdRes.push(p);
  }

  for (const u of update) {
    const existing = products.get(u.id);
    if (existing) {
      const merged = { ...existing, ...u, date_modified: new Date().toISOString() };
      products.set(u.id, merged);
      updatedRes.push(merged);
    }
  }

  for (const delId of toDelete) {
    const existing = products.get(delId);
    if (existing) {
      products.delete(delId);
      variations.delete(delId);
      deletedRes.push(existing);
    }
  }

  res.json({
    create: createdRes,
    update: updatedRes,
    delete: deletedRes
  });
});

app.listen(PORT, () => {
  console.log(`[Mock Woo] In-process WooCommerce v3 Server running on port ${PORT}`);
});
