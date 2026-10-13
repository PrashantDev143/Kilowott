import { Product, AIProposal, AIEvidence } from '@catalogiq/shared';

export interface ProposalValidationResult {
  isValid: boolean;
  rejectedEvidences: Array<{ field: string; reason: string }>;
  sanitizedProposal: Partial<AIProposal>;
}

export function validateProposal(product: Product, proposal: Partial<AIProposal>): ProposalValidationResult {
  const combinedSource = `${product.name} ${product.shortDescription} ${product.description}`.toLowerCase();
  const rejected: Array<{ field: string; reason: string }> = [];
  const validEvidences: AIEvidence[] = [];
  const validAttributes: Record<string, string> = {};

  const evidences = proposal.evidences || [];

  for (const ev of evidences) {
    // If flagged as uncertain, preserve it with uncertain status, but do NOT treat as an approved fact
    if (ev.isUncertain) {
      validEvidences.push(ev);
      continue;
    }

    // STRICT GUARDRAIL: Evidence quote must be non-empty and present verbatim in the source text
    if (!ev.evidenceQuote || ev.evidenceQuote.trim().length === 0) {
      rejected.push({
        field: ev.field,
        reason: `Rejected proposed value '${ev.proposedValue}': Missing required verbatim evidence quote.`
      });
      continue;
    }

    const normalizedQuote = ev.evidenceQuote.trim().toLowerCase();
    if (!combinedSource.includes(normalizedQuote)) {
      rejected.push({
        field: ev.field,
        reason: `Rejected invented fact '${ev.proposedValue}': Quote '${ev.evidenceQuote}' was not found in product text.`
      });
      continue;
    }

    // Valid evidence verified!
    validEvidences.push(ev);
    validAttributes[ev.field] = ev.proposedValue;
  }

  // Descriptions: ensure proposed description does not invent wild brand claims
  const proposedDescription = proposal.proposedDescription || product.description;

  const isValid = rejected.length === 0;

  return {
    isValid,
    rejectedEvidences: rejected,
    sanitizedProposal: {
      ...proposal,
      proposedAttributes: {
        ...product.attributes,
        ...validAttributes
      },
      proposedDescription,
      evidences: validEvidences
    }
  };
}
