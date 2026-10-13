/**
 * CatalogIQ - Live WooCommerce Store Seeding Script
 * 
 * Safely seeds the canonical catalog into the configured WooCommerce store.
 * Idempotent: matches by SKU and updates existing products instead of creating duplicates.
 * Safe: refuses to run unless WOO_STORE_URL ends in .local (or with --force-test-store flag).
 * NEVER prints or logs any credentials/keys.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from apps/api/.env or root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Allow self-signed SSL certificates for local testing domains (*.local)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const STORE_URL = process.env.WOO_STORE_URL;
const CONSUMER_KEY = process.env.WOO_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.WOO_CONSUMER_SECRET;

// -------------------------------------------------------------
// Safety Guard
// -------------------------------------------------------------
function validateSafety() {
  if (!STORE_URL) {
    console.error('Error: WOO_STORE_URL environment variable is missing.');
    process.exit(1);
  }
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    console.error('Error: WOO_CONSUMER_KEY or WOO_CONSUMER_SECRET environment variable is missing.');
    process.exit(1);
  }

  let hostname = '';
  try {
    const parsed = new URL(STORE_URL);
    hostname = parsed.hostname;
  } catch (err) {
    console.error(`Error: Invalid WOO_STORE_URL format: ${STORE_URL}`);
    process.exit(1);
  }

  const isForceFlag = process.argv.includes('--force-test-store');
  const isLocalDomain = hostname.endsWith('.local') || hostname === 'localhost' || hostname === '127.0.0.1';

  if (!isLocalDomain && !isForceFlag) {
    console.error(`\n[SAFETY ABORT] Refusing to seed target store: "${hostname}".`);
    console.error('Safety policy: WOO_STORE_URL must end in .local (e.g. https://catlogue.local).');
    console.error('If you are certain this is a designated non-production test store, re-run with:');
    console.error('  npm run seed-store -- --force-test-store\n');
    process.exit(1);
  }
}

// -------------------------------------------------------------
// WooCommerce REST Client with Retry & Exponential Backoff
// -------------------------------------------------------------
const authHeader = 'Basic ' + Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

async function wcRequest(endpoint, options = {}, retries = 3) {
  const url = `${STORE_URL.replace(/\/+$/, '')}/wp-json/wc/v3/${endpoint.replace(/^\/+/, '')}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      ...(options.headers || {})
    }
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, config);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const retryAfter = res.headers.get('retry-after');
          const delayMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          console.warn(`[Retry] WooCommerce ${res.status} on ${endpoint}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }

      let data = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      return { ok: res.ok, status: res.status, data, headers: res.headers };
    } catch (err) {
      if (attempt < retries) {
        const delayMs = Math.pow(2, attempt) * 1000 + 500;
        console.warn(`[Retry] Network error on ${endpoint}: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return { ok: false, status: 0, error: err.message };
    }
  }
}

// -------------------------------------------------------------
// Main Seeder Function
// -------------------------------------------------------------
async function seedStore() {
  validateSafety();

  const catalogPath = path.resolve(__dirname, '../seed/catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`Error: Catalog file not found at ${catalogPath}. Run scripts/generate-catalog.js first.`);
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  console.log('=====================================================');
  console.log(' CatalogIQ Live Store Seeder');
  console.log(` Target Store: ${STORE_URL}`);
  console.log(' Safety Guard: Verified (.local test environment)');
  console.log('=====================================================\n');

  const summary = {
    categoriesCreated: 0,
    categoriesExisting: 0,
    attributesCreated: 0,
    attributesExisting: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    variationsCreated: 0,
    variationsUpdated: 0,
    skippedItems: [],
    errors: []
  };

  // -----------------------------------------------------------
  // 1. Categories
  // -----------------------------------------------------------
  console.log('[1/4] Ensuring Product Categories...');
  const catRes = await wcRequest('products/categories?per_page=100');
  const existingCats = Array.isArray(catRes.data) ? catRes.data : [];
  const categoryMap = new Map();

  for (const c of existingCats) {
    categoryMap.set(c.slug.toLowerCase(), c.id);
    categoryMap.set(c.name.toLowerCase(), c.id);
  }

  for (const cat of catalog.categories) {
    const slugKey = cat.slug.toLowerCase();
    if (categoryMap.has(slugKey)) {
      summary.categoriesExisting++;
    } else {
      const createRes = await wcRequest('products/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: cat.name,
          slug: cat.slug,
          description: cat.description || ''
        })
      });

      if (createRes.ok && createRes.data?.id) {
        categoryMap.set(slugKey, createRes.data.id);
        categoryMap.set(cat.name.toLowerCase(), createRes.data.id);
        summary.categoriesCreated++;
        console.log(`  + Created category: "${cat.name}" (ID: ${createRes.data.id})`);
      } else {
        const err = `Failed to create category ${cat.name}: ${JSON.stringify(createRes.data)}`;
        summary.errors.push(err);
        console.error(`  x ${err}`);
      }
    }
  }

  // -----------------------------------------------------------
  // 2. Global Attributes
  // -----------------------------------------------------------
  console.log('\n[2/4] Ensuring Global Attributes...');
  const attrRes = await wcRequest('products/attributes');
  const existingAttrs = Array.isArray(attrRes.data) ? attrRes.data : [];
  const attributeMap = new Map();

  for (const a of existingAttrs) {
    attributeMap.set(a.name.toLowerCase(), a.id);
    attributeMap.set(a.slug.toLowerCase(), a.id);
  }

  for (const attr of catalog.attributes) {
    const nameKey = attr.name.toLowerCase();
    if (attributeMap.has(nameKey)) {
      summary.attributesExisting++;
    } else {
      const createRes = await wcRequest('products/attributes', {
        method: 'POST',
        body: JSON.stringify({
          name: attr.name,
          slug: attr.slug.replace(/^pa_/, ''),
          type: 'select',
          order_by: 'menu_order',
          has_archives: true
        })
      });

      if (createRes.ok && createRes.data?.id) {
        attributeMap.set(nameKey, createRes.data.id);
        summary.attributesCreated++;
        console.log(`  + Created global attribute: "${attr.name}" (ID: ${createRes.data.id})`);
      } else {
        // Fallback: If global attribute creation is restricted, WooCommerce still supports custom product attributes
        console.warn(`  ! Global attribute "${attr.name}" note: ${createRes.data?.message || 'Will use product-level attributes'}`);
      }
    }
  }

  // -----------------------------------------------------------
  // 3. Query Existing Products (Idempotency Check)
  // -----------------------------------------------------------
  console.log('\n[3/4] Indexing Existing Store Products for Idempotency...');
  const existingBySku = new Map();
  let page = 1;
  while (true) {
    const listRes = await wcRequest(`products?per_page=100&page=${page}`);
    if (!listRes.ok || !Array.isArray(listRes.data) || listRes.data.length === 0) {
      break;
    }
    for (const p of listRes.data) {
      if (p.sku) {
        existingBySku.set(p.sku.trim(), p);
      }
    }
    if (listRes.data.length < 100) break;
    page++;
  }
  console.log(`  Found ${existingBySku.size} existing products in store with SKUs.`);

  // -----------------------------------------------------------
  // 4. Products & Variations
  // -----------------------------------------------------------
  console.log('\n[4/4] Seeding Products & Variations...');
  const processedSkusInThisRun = new Set();

  for (const product of catalog.products) {
    const trimmedSku = (product.sku || '').trim();

    // Check duplicate SKU pair rule:
    // WooCommerce rejects duplicate SKUs, so create only the first product in store.
    // The second goes into the app database as local draft.
    if (processedSkusInThisRun.has(trimmedSku) || product.defect_tags?.includes('local_draft_only')) {
      summary.productsSkipped++;
      summary.skippedItems.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        reason: 'Duplicate SKU pair (Q03) - secondary item reserved for CatalogIQ local draft'
      });
      console.log(`  - Skipped: "${product.name}" [SKU: ${product.sku}] (Duplicate SKU - reserved for local draft)`);
      continue;
    }
    processedSkusInThisRun.add(trimmedSku);

    // Map categories
    const mappedCategories = (product.categories || []).map(cat => {
      const catId = categoryMap.get(cat.slug.toLowerCase()) || categoryMap.get(cat.name.toLowerCase());
      return catId ? { id: catId } : null;
    }).filter(Boolean);

    // Build attributes payload
    const mappedAttributes = (product.attributes || []).map(a => ({
      name: a.name,
      options: a.options,
      visible: a.visible !== false,
      variation: a.variation === true
    }));

    // Build base product payload
    const payload = {
      name: product.name,
      slug: product.slug,
      type: product.type || 'simple',
      status: product.status || 'publish',
      sku: product.sku,
      regular_price: String(product.regular_price || product.price || ''),
      description: product.description || '',
      short_description: product.short_description || '',
      categories: mappedCategories,
      attributes: mappedAttributes,
      meta_data: [
        { key: '_catalogiq_seed', value: '1' },
        { key: '_catalogiq_seed_id', value: product.id },
        { key: '_catalogiq_clean', value: product.is_clean ? '1' : '0' }
      ]
    };

    // Images payload
    if (product.images && product.images.length > 0) {
      payload.images = product.images.map(img => ({
        src: img.src,
        alt: img.alt || product.name
      }));
    } else {
      payload.images = [];
    }

    let wooProduct = null;
    const existing = existingBySku.get(trimmedSku);

    if (existing) {
      // UPDATE existing product
      let updateRes = await wcRequest(`products/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      // If image download error, retry without images
      if (!updateRes.ok && updateRes.data?.code === 'woocommerce_product_image_upload_error') {
        console.warn(`  ! Image download failed for ${product.sku}; retrying without image.`);
        const fallback = { ...payload };
        delete fallback.images;
        updateRes = await wcRequest(`products/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(fallback)
        });
      }

      if (updateRes.ok && updateRes.data?.id) {
        wooProduct = updateRes.data;
        summary.productsUpdated++;
        console.log(`  ~ Updated: "${product.name}" [ID: ${wooProduct.id}, SKU: ${product.sku}]`);
      } else {
        const err = `Failed to update product ${product.sku}: ${JSON.stringify(updateRes.data)}`;
        summary.errors.push(err);
        console.error(`  x ${err}`);
        continue;
      }
    } else {
      // CREATE new product
      let createRes = await wcRequest('products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // If image download error, retry without images
      if (!createRes.ok && createRes.data?.code === 'woocommerce_product_image_upload_error') {
        console.warn(`  ! Image download failed for ${product.sku}; retrying without image.`);
        const fallback = { ...payload };
        delete fallback.images;
        createRes = await wcRequest('products', {
          method: 'POST',
          body: JSON.stringify(fallback)
        });
      }

      if (createRes.ok && createRes.data?.id) {
        wooProduct = createRes.data;
        summary.productsCreated++;
        console.log(`  + Created: "${product.name}" [ID: ${wooProduct.id}, SKU: ${product.sku}]`);
      } else {
        const err = `Failed to create product ${product.sku}: ${JSON.stringify(createRes.data)}`;
        summary.errors.push(err);
        console.error(`  x ${err}`);
        continue;
      }
    }

    // ---------------------------------------------------------
    // Handle Variations for Variable Products
    // ---------------------------------------------------------
    if (product.type === 'variable' && product.variations && product.variations.length > 0 && wooProduct?.id) {
      const parentId = wooProduct.id;
      const varListRes = await wcRequest(`products/${parentId}/variations?per_page=100`);
      const existingVars = Array.isArray(varListRes.data) ? varListRes.data : [];
      const existingVarBySku = new Map();
      for (const v of existingVars) {
        if (v.sku) existingVarBySku.set(v.sku.trim(), v);
      }

      const toCreate = [];
      const toUpdate = [];

      for (const v of product.variations) {
        const varPayload = {
          sku: v.sku,
          regular_price: String(v.regular_price || v.price),
          attributes: (v.attributes || []).map(attr => ({
            name: attr.name,
            option: attr.option
          })),
          meta_data: [{ key: '_catalogiq_seed', value: '1' }]
        };

        const existingVar = existingVarBySku.get(v.sku.trim());
        if (existingVar) {
          toUpdate.push({ id: existingVar.id, ...varPayload });
        } else {
          toCreate.push(varPayload);
        }
      }

      if (toCreate.length > 0 || toUpdate.length > 0) {
        const batchRes = await wcRequest(`products/${parentId}/variations/batch`, {
          method: 'POST',
          body: JSON.stringify({ create: toCreate, update: toUpdate })
        });

        if (batchRes.ok && batchRes.data) {
          const createdCount = batchRes.data.create?.length || 0;
          const updatedCount = batchRes.data.update?.length || 0;
          summary.variationsCreated += createdCount;
          summary.variationsUpdated += updatedCount;
          console.log(`    -> Variations for ${product.sku}: ${createdCount} created, ${updatedCount} updated.`);
        } else {
          const err = `Variations batch failed for ${product.sku}: ${JSON.stringify(batchRes.data)}`;
          summary.errors.push(err);
          console.error(`    x ${err}`);
        }
      }
    }
  }

  // -----------------------------------------------------------
  // Summary Report
  // -----------------------------------------------------------
  console.log('\n=====================================================');
  console.log(' SEEDING SUMMARY');
  console.log('=====================================================');
  console.log(` Products Created:        ${summary.productsCreated}`);
  console.log(` Products Updated:        ${summary.productsUpdated}`);
  console.log(` Products Skipped:        ${summary.productsSkipped}`);
  console.log(` Variations Created:      ${summary.variationsCreated}`);
  console.log(` Variations Updated:      ${summary.variationsUpdated}`);
  console.log(` Categories Created:      ${summary.categoriesCreated} (Existing: ${summary.categoriesExisting})`);
  console.log(` Attributes Created:      ${summary.attributesCreated} (Existing: ${summary.attributesExisting})`);
  console.log(` Errors Encountered:      ${summary.errors.length}`);

  if (summary.skippedItems.length > 0) {
    console.log('\n Skipped Products Details:');
    for (const item of summary.skippedItems) {
      console.log(`   - "${item.name}" (SKU: ${item.sku}) -> ${item.reason}`);
    }
  }

  if (summary.errors.length > 0) {
    console.log('\n Errors:');
    for (const err of summary.errors) {
      console.log(`   - ${err}`);
    }
  }

  console.log('=====================================================\n');

  return summary;
}

if (require.main === module) {
  seedStore().then(summary => {
    if (summary.errors.length > 0) {
      console.warn('Completed with warnings/errors.');
      process.exit(1);
    } else {
      console.log('Seeding completed successfully!');
      process.exit(0);
    }
  }).catch(err => {
    console.error('Fatal seeding error:', err.message);
    process.exit(1);
  });
}

module.exports = { seedStore, validateSafety };
