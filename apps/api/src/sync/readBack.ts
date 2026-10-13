import { Product } from '@catalogiq/shared';

export interface ReadBackResult {
  matches: boolean;
  differences: string[];
}

export function verifyReadBack(pimProduct: Product, storeProduct: any): ReadBackResult {
  const differences: string[] = [];

  // Check SKU
  if (pimProduct.sku && storeProduct.sku && pimProduct.sku.trim().toLowerCase() !== storeProduct.sku.trim().toLowerCase()) {
    differences.push(`SKU mismatch: PIM '${pimProduct.sku}' vs Store '${storeProduct.sku}'`);
  }

  // Check Price (normalize string/number)
  const storePrice = parseFloat(storeProduct.regular_price || storeProduct.price || '0');
  if (Math.abs(pimProduct.price - storePrice) > 0.01) {
    differences.push(`Price mismatch: PIM '${pimProduct.price}' vs Store '${storePrice}'`);
  }

  // Check Name
  if (pimProduct.name && storeProduct.name && pimProduct.name.trim() !== storeProduct.name.trim()) {
    differences.push(`Title mismatch: PIM '${pimProduct.name}' vs Store '${storeProduct.name}'`);
  }

  return {
    matches: differences.length === 0,
    differences
  };
}
