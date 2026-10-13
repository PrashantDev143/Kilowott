import { describe, it, expect } from 'vitest';
import { evaluateQuality } from '../src/domain/quality/rules';
import { Product } from '@catalogiq/shared';

describe('Quality Engine (Rules Q01 - Q12)', () => {
  const baseProduct: Product = {
    id: 'test-1',
    name: 'Classic Oxford Button-Down Shirt',
    sku: 'SHIRT-OXF-001',
    price: 49.99,
    description: 'A timeless wardrobe essential crafted from 100% premium cotton with a tailored modern fit and durable buttons.',
    shortDescription: '100% cotton Oxford shirt.',
    categories: ['Apparel'],
    status: 'publish',
    syncStatus: 'draft',
    attributes: { material: 'Cotton' },
    images: [{ id: '1', url: 'https://example.com/img.jpg', altText: 'Shirt', position: 0 }],
    variants: [],
    qualityScore: 100,
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('scores clean product at 100 (Healthy band)', () => {
    const res = evaluateQuality(baseProduct);
    expect(res.score).toBe(100);
    expect(res.band).toBe('Healthy');
    expect(res.violations.length).toBe(0);
  });

  it('deducts 25 points for missing or short title (Q01)', () => {
    const p = { ...baseProduct, name: 'AB' };
    const res = evaluateQuality(p);
    expect(res.score).toBe(75);
    expect(res.violations.some(v => v.ruleId === 'Q01')).toBe(true);
  });

  it('deducts 20 points for missing SKU (Q02)', () => {
    const p = { ...baseProduct, sku: '' };
    const res = evaluateQuality(p);
    expect(res.score).toBe(80);
    expect(res.violations.some(v => v.ruleId === 'Q02')).toBe(true);
  });

  it('deducts 20 points for duplicate SKU (Q03)', () => {
    const otherProduct = { ...baseProduct, id: 'test-2', sku: 'SHIRT-OXF-001' };
    const res = evaluateQuality(baseProduct, { allProducts: [baseProduct, otherProduct] });
    expect(res.score).toBe(80);
    expect(res.violations.some(v => v.ruleId === 'Q03')).toBe(true);
  });

  it('deducts 20 points for zero or negative price (Q04)', () => {
    const p = { ...baseProduct, price: 0 };
    const res = evaluateQuality(p);
    expect(res.score).toBe(80);
    expect(res.violations.some(v => v.ruleId === 'Q04')).toBe(true);
  });

  it('deducts 15 points for missing description (Q05)', () => {
    const p = { ...baseProduct, description: '' };
    const res = evaluateQuality(p);
    expect(res.score).toBe(85);
    expect(res.violations.some(v => v.ruleId === 'Q05')).toBe(true);
  });

  it('deducts 6 points for brief description under 80 characters (Q06)', () => {
    const p = { ...baseProduct, description: 'Short shirt text.' };
    const res = evaluateQuality(p);
    expect(res.score).toBe(94);
    expect(res.violations.some(v => v.ruleId === 'Q06')).toBe(true);
  });

  it('deducts 10 points for missing images (Q07)', () => {
    const p = { ...baseProduct, images: [] };
    const res = evaluateQuality(p);
    expect(res.score).toBe(90);
    expect(res.violations.some(v => v.ruleId === 'Q07')).toBe(true);
  });
});
