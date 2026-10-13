import { Router, Request, Response } from 'express';
import { db } from '../db/repository';
import { evaluateQuality } from '../domain/quality/rules';

export const qualityRouter = Router();

// GET /api/quality/summary
qualityRouter.get('/summary', (req: Request, res: Response) => {
  const products = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();

  let totalScore = 0;
  const bands = { Healthy: 0, 'Needs work': 0, Poor: 0 };
  const violationCounts: Record<string, { count: number; name: string; severity: string; canAiFix: boolean }> = {
    Q01: { count: 0, name: 'Title missing or < 3 chars', severity: 'Critical', canAiFix: false },
    Q02: { count: 0, name: 'SKU missing', severity: 'Critical', canAiFix: false },
    Q03: { count: 0, name: 'Duplicate SKU in catalog', severity: 'Critical', canAiFix: false },
    Q04: { count: 0, name: 'Price missing or <= 0', severity: 'Critical', canAiFix: false },
    Q05: { count: 0, name: 'Description missing', severity: 'Major', canAiFix: true },
    Q06: { count: 0, name: 'Description under 80 chars', severity: 'Minor', canAiFix: true },
    Q07: { count: 0, name: 'No images uploaded', severity: 'Major', canAiFix: false },
    Q08: { count: 0, name: 'Missing image alt text', severity: 'Minor', canAiFix: true },
    Q09: { count: 0, name: 'Unassigned category', severity: 'Major', canAiFix: true },
    Q10: { count: 0, name: 'Required type attribute missing', severity: 'Major', canAiFix: true },
    Q11: { count: 0, name: 'Attribute value inconsistent', severity: 'Minor', canAiFix: true },
    Q12: { count: 0, name: 'Variant missing SKU or price', severity: 'Major', canAiFix: false }
  };

  const syncStateCounts: Record<string, number> = {
    draft: 0,
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    conflict: 0
  };

  for (const p of products) {
    const q = evaluateQuality(p, { allProducts: products, attributes: attrs, productTypes: types });
    totalScore += q.score;
    bands[q.band]++;

    const status = p.syncStatus || 'draft';
    syncStateCounts[status] = (syncStateCounts[status] || 0) + 1;

    for (const v of q.violations) {
      if (violationCounts[v.ruleId]) {
        violationCounts[v.ruleId].count++;
      }
    }
  }

  const averageScore = products.length > 0 ? Math.round(totalScore / products.length) : 100;

  res.json({
    totalProducts: products.length,
    averageScore,
    bands,
    syncStateCounts,
    violations: Object.entries(violationCounts).map(([ruleId, info]) => ({
      ruleId,
      ...info
    }))
  });
});
