/**
 * CatalogIQ - Reset WooCommerce Store Script
 * 
 * Safely deletes only products marked with _catalogiq_seed=1 in the WooCommerce store,
 * leaving any existing store data untouched, and then re-seeds with the canonical catalog.
 * Refuses to run unless WOO_STORE_URL ends in .local (or with --force-test-store).
 * NEVER logs or prints credentials.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { seedStore, validateSafety } = require('./seed-store');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const STORE_URL = process.env.WOO_STORE_URL;
const CONSUMER_KEY = process.env.WOO_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.WOO_CONSUMER_SECRET;

const authHeader = 'Basic ' + Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

async function wcRequest(endpoint, options = {}) {
  const url = `${STORE_URL.replace(/\/+$/, '')}/wp-json/wc/v3/${endpoint.replace(/^\/+/, '')}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function resetStore() {
  validateSafety();

  console.log('=====================================================');
  console.log(' CatalogIQ Store Reset & Re-seed');
  console.log(` Target Store: ${STORE_URL}`);
  console.log(' Safety Guard: Verified (.local test environment)');
  console.log('=====================================================\n');

  console.log('[1/2] Discovering products marked with _catalogiq_seed=1...');
  const seededProducts = [];
  let page = 1;

  while (true) {
    const listRes = await wcRequest(`products?per_page=100&page=${page}`);
    if (!listRes.ok || !Array.isArray(listRes.data) || listRes.data.length === 0) {
      break;
    }

    for (const p of listRes.data) {
      const isSeeded = (p.meta_data || []).some(
        m => m.key === '_catalogiq_seed' && (m.value === '1' || m.value === 1)
      );
      if (isSeeded) {
        seededProducts.push(p);
      }
    }

    if (listRes.data.length < 100) break;
    page++;
  }

  console.log(`  Found ${seededProducts.length} seeded products to remove.`);

  if (seededProducts.length > 0) {
    console.log('  Deleting seeded products (force=true)...');
    // Delete in batches of 10 or one-by-one
    for (const p of seededProducts) {
      const delRes = await wcRequest(`products/${p.id}?force=true`, { method: 'DELETE' });
      if (delRes.ok) {
        console.log(`  - Deleted: "${p.name}" (ID: ${p.id}, SKU: ${p.sku})`);
      } else {
        console.warn(`  ! Could not delete product #${p.id}: ${delRes.data?.message || delRes.status}`);
      }
    }
  }

  console.log('\n[2/2] Re-seeding store with canonical catalog...');
  const summary = await seedStore();

  return {
    deletedCount: seededProducts.length,
    ...summary
  };
}

if (require.main === module) {
  resetStore().then(summary => {
    console.log(`Store reset complete: Deleted ${summary.deletedCount} seeded products, re-seeded fresh.`);
    process.exit(0);
  }).catch(err => {
    console.error('Fatal reset error:', err.message);
    process.exit(1);
  });
}

module.exports = { resetStore };
