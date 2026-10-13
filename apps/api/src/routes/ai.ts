import { Router, Request, Response } from 'express';
import { db } from '../db/repository';
import { catalogAgent } from '../ai/agent';
import { evaluateQuality } from '../domain/quality/rules';

export const aiRouter = Router();

// POST /api/ai/scan
aiRouter.post('/scan', async (req: Request, res: Response) => {
  const { productIds } = req.body;
  try {
    const proposals = await catalogAgent.runEnrichmentScan(productIds);
    res.json({
      message: `Enrichment pass completed. Generated ${proposals.length} proposal(s).`,
      proposals
    });
  } catch (err: any) {
    res.status(500).json({ error: 'AI Enrichment scan failed', message: err.message });
  }
});

// GET /api/ai/proposals
aiRouter.get('/proposals', (req: Request, res: Response) => {
  const { status } = req.query;
  let proposals = db.getAIProposals();
  if (status && status !== 'all') {
    proposals = proposals.filter(p => p.status === status);
  }
  res.json(proposals);
});

// POST /api/ai/proposals/:id/approve
aiRouter.post('/proposals/:id/approve', (req: Request, res: Response) => {
  const proposal = db.getAIProposalById(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  const product = db.getProductById(proposal.productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Apply proposed changes safely
  if (proposal.proposedDescription) {
    product.description = proposal.proposedDescription;
  }

  product.attributes = {
    ...product.attributes,
    ...proposal.proposedAttributes
  };

  // Re-evaluate quality score
  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();
  const q = evaluateQuality(product, { allProducts: all, attributes: attrs, productTypes: types });
  product.qualityScore = q.score;

  // Returning to draft ensures publish requires human confirmation
  product.syncStatus = 'draft';

  const updatedProduct = db.saveProduct(product, 'Applied AI enrichment proposal with verified evidence');

  proposal.status = 'approved';
  proposal.reviewedAt = new Date().toISOString();
  db.saveAIProposal(proposal);

  res.json({
    message: 'Proposal approved and applied to product',
    product: updatedProduct,
    proposal
  });
});

// POST /api/ai/proposals/:id/reject
aiRouter.post('/proposals/:id/reject', (req: Request, res: Response) => {
  const proposal = db.getAIProposalById(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  proposal.status = 'rejected';
  proposal.reviewNote = req.body.reason || 'Rejected by reviewer';
  proposal.reviewedAt = new Date().toISOString();
  db.saveAIProposal(proposal);

  res.json({ message: 'Proposal rejected', proposal });
});

// POST /api/ai/proposals/bulk-approve
aiRouter.post('/proposals/bulk-approve', (req: Request, res: Response) => {
  const { proposalIds } = req.body;
  if (!Array.isArray(proposalIds)) {
    return res.status(400).json({ error: 'proposalIds array is required' });
  }

  const results: Array<{ id: string; approved: boolean }> = [];
  const all = db.getProducts();
  const attrs = db.getAttributes();
  const types = db.getProductTypes();

  for (const id of proposalIds) {
    const proposal = db.getAIProposalById(id);
    if (!proposal || proposal.status !== 'pending') {
      results.push({ id, approved: false });
      continue;
    }

    const product = db.getProductById(proposal.productId);
    if (!product) {
      results.push({ id, approved: false });
      continue;
    }

    if (proposal.proposedDescription) {
      product.description = proposal.proposedDescription;
    }
    product.attributes = {
      ...product.attributes,
      ...proposal.proposedAttributes
    };

    const q = evaluateQuality(product, { allProducts: all, attributes: attrs, productTypes: types });
    product.qualityScore = q.score;
    product.syncStatus = 'draft';

    db.saveProduct(product, 'Bulk approved AI proposal');

    proposal.status = 'approved';
    proposal.reviewedAt = new Date().toISOString();
    db.saveAIProposal(proposal);

    results.push({ id, approved: true });
  }

  res.json({ message: `Approved ${results.filter(r => r.approved).length} proposal(s)`, results });
});
