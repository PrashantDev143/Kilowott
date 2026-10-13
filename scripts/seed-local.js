/**
 * CatalogIQ - Seed Local Database Script
 * 
 * Seeds CatalogIQ's internal repository (data/catalogiq-db.json) with all 30 products
 * from seed/catalog.json, including the duplicate-SKU pair where the second product (p-30)
 * is kept as a local draft with the conflicting SKU.
 */

const fs = require('fs');
const path = require('path');

const catalogPath = path.resolve(__dirname, '../seed/catalog.json');
const dbPath = path.resolve(__dirname, '../data/catalogiq-db.json');

if (!fs.existsSync(catalogPath)) {
  console.error(`Error: Catalog file not found at ${catalogPath}`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Convert catalog products to CatalogIQ Product schema
const internalProducts = catalog.products.map(p => {
  // Convert array attributes to dictionary format used by CatalogIQ domain logic
  const attrDict = {};
  if (Array.isArray(p.attributes)) {
    for (const a of p.attributes) {
      const key = a.name.toLowerCase();
      attrDict[key] = Array.isArray(a.options) ? a.options[0] : a.options;
    }
  }

  // Map category names
  const categoryNames = Array.isArray(p.categories)
    ? p.categories.map(c => typeof c === 'string' ? c : c.name)
    : [];

  // Determine productTypeId
  let productTypeId = 'type-apparel';
  if (categoryNames.includes('Shoes') || categoryNames.includes('Footwear')) {
    productTypeId = 'type-footwear';
  } else if (categoryNames.includes('Accessories')) {
    productTypeId = null;
  }

  // Determine sync status: clean products are synced, defective or draft-only are drafts
  let syncStatus = p.is_clean ? 'synced' : 'draft';
  if (p.defect_tags?.includes('local_draft_only')) {
    syncStatus = 'draft';
  }

  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: parseFloat(p.price || p.regular_price || '0') || 0,
    regularPrice: parseFloat(p.regular_price || p.price || '0') || 0,
    description: p.description || '',
    shortDescription: p.short_description || '',
    categories: categoryNames,
    status: p.status || 'draft',
    syncStatus,
    productTypeId,
    attributes: attrDict,
    images: (p.images || []).map((img, idx) => ({
      id: `img-${p.id}-${idx + 1}`,
      url: img.src,
      altText: img.alt || p.name,
      position: idx
    })),
    variants: (p.variations || []).map((v, idx) => ({
      id: `var-${p.id}-${idx + 1}`,
      sku: v.sku,
      price: parseFloat(v.price || v.regular_price || '0') || 0,
      attributes: (v.attributes || []).reduce((acc, curr) => {
        acc[curr.name.toLowerCase()] = curr.option;
        return acc;
      }, {})
    })),
    qualityScore: p.is_clean ? 100 : 85,
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
});

const versions = internalProducts.map(p => ({
  id: `ver-${p.id}-1`,
  productId: p.id,
  versionNumber: 1,
  snapshot: p,
  changeSummary: 'Canonical catalog seed initialization',
  createdAt: new Date().toISOString()
}));

const internalAttributes = [
  {
    id: 'attr-material',
    name: 'Material',
    slug: 'material',
    type: 'select',
    allowedValues: ['Cotton', 'Wool', 'Leather', 'Polyester', 'Denim', 'Canvas', 'Linen'],
    isRequired: true
  },
  {
    id: 'attr-color',
    name: 'Color',
    slug: 'color',
    type: 'select',
    allowedValues: ['Black', 'White', 'Navy', 'Brown', 'Grey', 'Red', 'Green', 'Blue'],
    isRequired: false
  },
  {
    id: 'attr-size',
    name: 'Size',
    slug: 'size',
    type: 'select',
    allowedValues: ['XS', 'Small', 'Medium', 'Large', 'XL', '6', '7', '8', '9', '10'],
    isRequired: false
  }
];

const productTypes = [
  {
    id: 'type-apparel',
    name: 'Apparel',
    slug: 'apparel',
    attributeIds: ['attr-material', 'attr-color']
  },
  {
    id: 'type-footwear',
    name: 'Footwear',
    slug: 'footwear',
    attributeIds: ['attr-material', 'attr-color', 'attr-size']
  }
];

const state = {
  products: internalProducts,
  versions,
  attributes: internalAttributes,
  productTypes,
  syncJobs: [],
  syncLogs: [],
  aiProposals: [],
  storeConfig: {
    storeUrl: process.env.WOO_STORE_URL || 'https://catlogue.local',
    consumerKey: process.env.WOO_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_CONSUMER_SECRET || '',
    webhookSecret: process.env.WOO_WEBHOOK_SECRET || 'mock_webhook_secret_12345',
    mode: process.env.STORE_MODE || 'live'
  }
};

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), 'utf8');

console.log('=====================================================');
console.log(' CatalogIQ Local Database Seeding Complete');
console.log('=====================================================');
console.log(` Target File:         ${dbPath}`);
console.log(` Total Products:      ${internalProducts.length}`);
console.log(` Clean Products:      ${internalProducts.filter(p => p.qualityScore === 100).length}`);
console.log(` Defective Products:  ${internalProducts.filter(p => p.qualityScore < 100).length}`);
console.log(` Duplicate SKU Pair:  p-29 ("Heritage Leather Driving Gloves") and p-30 ("Cable-Knit Merino Wool Mittens") share SKU: DUP-SKU-999`);
console.log('                      p-30 is stored as a local draft in CatalogIQ DB without conflicting on WooCommerce.');
console.log('=====================================================\n');
