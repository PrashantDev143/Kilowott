import { Product, AIProposal } from '@catalogiq/shared';
import { db } from '../db/repository';
import { evaluateQuality } from '../domain/quality/rules';
import { IAIProvider, OfflineRuleBasedProvider, GeminiAIProvider } from './provider';
import { validateProposal } from './validator';

export class CatalogAgent {
  private provider: IAIProvider;

  constructor() {
    const aiProviderMode = process.env.AI_PROVIDER || 'offline';
    const geminiKey = process.env.GEMINI_API_KEY;

    if (aiProviderMode === 'gemini' && geminiKey) {
      this.provider = new GeminiAIProvider(geminiKey, process.env.GEMINI_MODEL || 'gemini-1.5-flash');
    } else {
      this.provider = new OfflineRuleBasedProvider();
    }
  }

  // Tool 1: scan_catalog
  async toolScanCatalog(limit = 10): Promise<Array<{ product: Product; score: number; violations: any[] }>> {
    const products = db.getProducts();
    const attrs = db.getAttributes();
    const types = db.getProductTypes();

    const scored = products.map(p => {
      const q = evaluateQuality(p, { allProducts: products, attributes: attrs, productTypes: types });
      return { product: p, score: q.score, violations: q.violations };
    });

    // Sort ascending (lowest quality scores first)
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit);
  }

  // Tool 2: get_product
  async toolGetProduct(productId: string): Promise<Product | null> {
    return db.getProductById(productId);
  }

  // Tool 3: propose_changes
  async toolProposeChanges(product: Product): Promise<Partial<AIProposal>> {
    return this.provider.generateProposal(product);
  }

  // Tool 4: validate_proposal
  async toolValidateProposal(product: Product, proposal: Partial<AIProposal>) {
    return validateProposal(product, proposal);
  }

  // Tool 5: submit_for_review
  async toolSubmitForReview(product: Product, validatedProposal: Partial<AIProposal>): Promise<AIProposal> {
    const proposal: AIProposal = {
      id: `prop-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      originalDescription: product.description,
      proposedDescription: validatedProposal.proposedDescription || product.description,
      originalAttributes: { ...product.attributes },
      proposedAttributes: { ...(validatedProposal.proposedAttributes || product.attributes) },
      evidences: validatedProposal.evidences || [],
      overallConfidence: validatedProposal.overallConfidence || 0.9,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return db.saveAIProposal(proposal);
  }

  // Agent Orchestrator: Scan, propose, validate, queue
  async runEnrichmentScan(targetProductIds?: string[]): Promise<AIProposal[]> {
    let targets: Product[] = [];

    if (targetProductIds && targetProductIds.length > 0) {
      targets = targetProductIds.map(id => db.getProductById(id)).filter((p): p is Product => p !== null);
    } else {
      const weak = await this.toolScanCatalog(15);
      targets = weak.filter(w => w.score < 90).map(w => w.product);
    }

    const createdProposals: AIProposal[] = [];

    for (const product of targets) {
      // Step 1: propose
      const rawProposal = await this.toolProposeChanges(product);

      // Step 2: validate guardrails & evidence
      const validation = await this.toolValidateProposal(product, rawProposal);

      // Step 3: submit for review
      const proposal = await this.toolSubmitForReview(product, validation.sanitizedProposal);
      createdProposals.push(proposal);
    }

    return createdProposals;
  }
}

export const catalogAgent = new CatalogAgent();
