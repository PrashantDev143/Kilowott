import {
  Product,
  QualityScoreResult,
  QualityViolation,
  QualityBand,
  AttributeDefinition,
  ProductType
} from '@catalogiq/shared';

export interface QualityContext {
  allProducts?: Product[];
  attributes?: AttributeDefinition[];
  productTypes?: ProductType[];
}

export function evaluateQuality(product: Product, context: QualityContext = {}): QualityScoreResult {
  const violations: QualityViolation[] = [];
  const { allProducts = [], attributes = [], productTypes = [] } = context;

  // Q01: Name missing or shorter than 3 characters
  if (!product.name || product.name.trim().length < 3) {
    violations.push({
      ruleId: 'Q01',
      severity: 'Critical',
      deduction: 25,
      field: 'name',
      message: 'Product title is missing or shorter than 3 characters.',
      canAiFix: false
    });
  }

  // Q02: SKU missing
  if (!product.sku || product.sku.trim().length === 0) {
    violations.push({
      ruleId: 'Q02',
      severity: 'Critical',
      deduction: 20,
      field: 'sku',
      message: 'Product SKU identifier is missing.',
      canAiFix: false
    });
  }

  // Q03: SKU duplicated elsewhere in the catalog
  if (product.sku && allProducts.length > 0) {
    const isDuplicate = allProducts.some(
      p => p.id !== product.id && p.sku.trim().toLowerCase() === product.sku.trim().toLowerCase()
    );
    if (isDuplicate) {
      violations.push({
        ruleId: 'Q03',
        severity: 'Critical',
        deduction: 20,
        field: 'sku',
        message: `Duplicate SKU detected: '${product.sku}' is used by another product.`,
        canAiFix: false
      });
    }
  }

  // Q04: Price missing or zero or below
  if (product.price === undefined || product.price === null || product.price <= 0) {
    violations.push({
      ruleId: 'Q04',
      severity: 'Critical',
      deduction: 20,
      field: 'price',
      message: 'Price must be greater than zero.',
      canAiFix: false
    });
  }

  // Q05: Description missing
  const desc = (product.description || '').trim();
  if (!desc) {
    violations.push({
      ruleId: 'Q05',
      severity: 'Major',
      deduction: 15,
      field: 'description',
      message: 'Product description is completely missing.',
      canAiFix: true
    });
  } else if (desc.length < 80) {
    // Q06: Description shorter than 80 characters
    violations.push({
      ruleId: 'Q06',
      severity: 'Minor',
      deduction: 6,
      field: 'description',
      message: `Product description is too brief (${desc.length}/80 chars minimum).`,
      canAiFix: true
    });
  }

  // Q07: No image
  if (!product.images || product.images.length === 0) {
    violations.push({
      ruleId: 'Q07',
      severity: 'Major',
      deduction: 10,
      field: 'images',
      message: 'Product has no images uploaded.',
      canAiFix: false
    });
  } else {
    // Q08: Image without alt text
    const missingAlt = product.images.some(img => !img.altText || img.altText.trim() === '');
    if (missingAlt) {
      violations.push({
        ruleId: 'Q08',
        severity: 'Minor',
        deduction: 3,
        field: 'images',
        message: 'One or more product images are missing descriptive accessibility alt text.',
        canAiFix: true
      });
    }
  }

  // Q09: No category
  if (!product.categories || product.categories.length === 0) {
    violations.push({
      ruleId: 'Q09',
      severity: 'Major',
      deduction: 8,
      field: 'categories',
      message: 'Product is not assigned to any catalog category.',
      canAiFix: true
    });
  }

  // Q10: Required attribute for product type is missing
  if (product.productTypeId) {
    const pType = productTypes.find(t => t.id === product.productTypeId);
    if (pType && pType.attributeIds) {
      let missingReqAttrCount = 0;
      for (const attrId of pType.attributeIds) {
        const attrDef = attributes.find(a => a.id === attrId);
        if (attrDef && attrDef.isRequired) {
          const val = product.attributes[attrDef.slug] || product.attributes[attrDef.name.toLowerCase()];
          if (!val || String(val).trim() === '') {
            missingReqAttrCount++;
            if (missingReqAttrCount <= 3) {
              violations.push({
                ruleId: 'Q10',
                severity: 'Major',
                deduction: 8,
                field: `attributes.${attrDef.slug}`,
                message: `Required attribute '${attrDef.name}' is missing for type '${pType.name}'.`,
                canAiFix: true
              });
            }
          }
        }
      }
    }
  }

  // Q11: Attribute value outside allowed list or inconsistent form
  if (product.attributes && Object.keys(product.attributes).length > 0) {
    let inconsistentCount = 0;
    for (const [attrKey, attrVal] of Object.entries(product.attributes)) {
      const attrDef = attributes.find(
        a => a.slug.toLowerCase() === attrKey.toLowerCase() || a.name.toLowerCase() === attrKey.toLowerCase()
      );
      if (attrDef && attrDef.allowedValues && attrDef.allowedValues.length > 0) {
        const valStr = String(attrVal).trim();
        const exactMatch = attrDef.allowedValues.includes(valStr);
        const caseInsensitiveMatch = attrDef.allowedValues.find(v => v.toLowerCase() === valStr.toLowerCase());

        if (!exactMatch) {
          inconsistentCount++;
          if (inconsistentCount <= 3) {
            const hint = caseInsensitiveMatch ? ` Should be normalized to '${caseInsensitiveMatch}'.` : '';
            violations.push({
              ruleId: 'Q11',
              severity: 'Minor',
              deduction: 4,
              field: `attributes.${attrKey}`,
              message: `Attribute value '${valStr}' is not normalized.${hint}`,
              canAiFix: true
            });
          }
        }
      }
    }
  }

  // Q12: Variant without its own SKU or price
  if (product.variants && product.variants.length > 0) {
    const invalidVariant = product.variants.some(v => !v.sku || !v.price || v.price <= 0);
    if (invalidVariant) {
      violations.push({
        ruleId: 'Q12',
        severity: 'Major',
        deduction: 10,
        field: 'variants',
        message: 'One or more variants are missing a valid SKU or price.',
        canAiFix: false
      });
    }
  }

  // Calculate overall score (capped at 0 min, 100 max)
  const totalDeductions = violations.reduce((sum, v) => sum + v.deduction, 0);
  const score = Math.max(0, 100 - totalDeductions);

  let band: QualityBand = 'Healthy';
  if (score < 70) {
    band = 'Poor';
  } else if (score < 90) {
    band = 'Needs work';
  }

  return {
    score,
    band,
    violations
  };
}
