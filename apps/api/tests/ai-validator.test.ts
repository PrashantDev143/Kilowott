import { describe, it, expect } from 'vitest';
import { validateProposal } from '../src/ai/validator';
import { Product } from '@catalogiq/shared';

describe('AI Proposal Validator & Guardrails', () => {
  const product: Product = {
    id: 'p-1',
    name: '100% Cotton Chambray Workshirt in Navy',
    sku: 'SHIRT-CHM-018',
    price: 62.0,
    description: 'Durable utility shirt with reinforced triple-needle stitching.',
    shortDescription: '100% cotton chambray utility shirt in navy.',
    categories: ['Apparel'],
    status: 'draft',
    syncStatus: 'draft',
    attributes: {},
    images: [],
    variants: [],
    qualityScore: 84,
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('accepts proposal with genuine verbatim evidence quote', () => {
    const proposal = {
      proposedAttributes: { material: 'Cotton' },
      evidences: [
        {
          field: 'material',
          proposedValue: 'Cotton',
          evidenceQuote: '100% cotton',
          confidence: 0.95,
          isUncertain: false
        }
      ]
    };

    const res = validateProposal(product, proposal);
    expect(res.isValid).toBe(true);
    expect(res.rejectedEvidences.length).toBe(0);
    expect(res.sanitizedProposal.proposedAttributes?.material).toBe('Cotton');
  });

  it('rejects invented fact when evidence quote is missing or not in source text', () => {
    const proposal = {
      proposedAttributes: { material: 'Cashmere' },
      evidences: [
        {
          field: 'material',
          proposedValue: 'Cashmere',
          evidenceQuote: 'pure cashmere', // NOT in source text!
          confidence: 0.95,
          isUncertain: false
        }
      ]
    };

    const res = validateProposal(product, proposal);
    expect(res.isValid).toBe(false);
    expect(res.rejectedEvidences.length).toBe(1);
    expect(res.rejectedEvidences[0].field).toBe('material');
    // Cashmere must NOT be included in sanitized attributes!
    expect(res.sanitizedProposal.proposedAttributes?.material).toBeUndefined();
  });

  it('preserves uncertain flag without treating it as an approved fact', () => {
    const proposal = {
      evidences: [
        {
          field: 'material',
          proposedValue: 'Unknown',
          evidenceQuote: '',
          confidence: 0.2,
          isUncertain: true
        }
      ]
    };

    const res = validateProposal(product, proposal);
    expect(res.isValid).toBe(true);
    expect(res.sanitizedProposal.evidences?.[0].isUncertain).toBe(true);
  });
});
