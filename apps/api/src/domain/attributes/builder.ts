import { Variant } from '@catalogiq/shared';

export interface AttributeOption {
  slug: string;
  name: string;
  values: string[];
}

export function generateVariationMatrix(
  productId: string,
  baseSku: string,
  basePrice: number,
  options: AttributeOption[]
): Variant[] {
  if (options.length === 0) return [];

  // Cartesian product generator
  const cartesian = (arrays: string[][]): string[][] => {
    return arrays.reduce<string[][]>(
      (acc, curr) => acc.flatMap(c => curr.map(n => [...c, n])),
      [[]]
    );
  };

  const valuesArray = options.map(opt => opt.values);
  const combinations = cartesian(valuesArray);

  return combinations.map((combo, idx) => {
    const attributes: Record<string, string> = {};
    const skuSuffixParts: string[] = [];

    combo.forEach((val, optIdx) => {
      const opt = options[optIdx];
      attributes[opt.slug] = val;
      skuSuffixParts.push(val.toUpperCase().replace(/\s+/g, ''));
    });

    const sku = `${baseSku}-${skuSuffixParts.join('-')}`;

    return {
      id: `var-${productId}-${idx + 1}`,
      productId,
      sku,
      price: basePrice,
      attributes
    };
  });
}
