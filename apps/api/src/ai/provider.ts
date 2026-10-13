import { Product, AIProposal, AIEvidence } from '@catalogiq/shared';

export interface IAIProvider {
  name: string;
  generateProposal(product: Product): Promise<Partial<AIProposal>>;
}

/**
 * Offline rule-based AI provider fallback (deterministic, fast, zero API key required)
 * Extracts material, color, and size mentions directly from product title or text,
 * guaranteeing genuine evidence quotes from source text.
 */
export class OfflineRuleBasedProvider implements IAIProvider {
  name = 'OfflineRuleBasedProvider';

  async generateProposal(product: Product): Promise<Partial<AIProposal>> {
    const combinedSource = `${product.name} ${product.shortDescription} ${product.description}`;
    const evidences: AIEvidence[] = [];
    const proposedAttributes: Record<string, string> = { ...product.attributes };

    // 1. Material extraction rule
    const materialPatterns = [
      { regex: /\b(100%\s+cotton)\b/i, val: 'Cotton', quote: '100% cotton' },
      { regex: /\b(organic\s+cotton)\b/i, val: 'Cotton', quote: 'organic cotton' },
      { regex: /\b(cotton)\b/i, val: 'Cotton', quote: 'cotton' },
      { regex: /\b(merino\s+wool)\b/i, val: 'Wool', quote: 'merino wool' },
      { regex: /\b(wool)\b/i, val: 'Wool', quote: 'wool' },
      { regex: /\b(genuine\s+leather)\b/i, val: 'Leather', quote: 'genuine leather' },
      { regex: /\b(leather)\b/i, val: 'Leather', quote: 'leather' },
      { regex: /\b(polyester)\b/i, val: 'Polyester', quote: 'polyester' },
      { regex: /\b(canvas)\b/i, val: 'Canvas', quote: 'canvas' },
      { regex: /\b(denim)\b/i, val: 'Denim', quote: 'denim' }
    ];

    let foundMaterial = false;
    for (const pat of materialPatterns) {
      const match = combinedSource.match(pat.regex);
      if (match) {
        evidences.push({
          field: 'material',
          proposedValue: pat.val,
          evidenceQuote: match[0],
          confidence: 0.95,
          isUncertain: false,
          reasoning: `Extracted material specification '${pat.val}' directly from text.`
        });
        proposedAttributes['material'] = pat.val;
        foundMaterial = true;
        break;
      }
    }

    // If product has clothing category or title indicating wear but NO material mentioned in text,
    // explicitly flag material as UNCERTAIN rather than hallucinating/guessing!
    if (!foundMaterial && !product.attributes['material']) {
      evidences.push({
        field: 'material',
        proposedValue: 'Unknown',
        evidenceQuote: '',
        confidence: 0.2,
        isUncertain: true,
        reasoning: 'Product source text contains no verifiable mention of material. Flagged as uncertain.'
      });
    }

    // 2. Color extraction rule
    const colorPatterns = [
      { regex: /\b(black)\b/i, val: 'Black' },
      { regex: /\b(white)\b/i, val: 'White' },
      { regex: /\b(navy\s+blue|navy)\b/i, val: 'Navy' },
      { regex: /\b(brown)\b/i, val: 'Brown' },
      { regex: /\b(grey|gray)\b/i, val: 'Grey' },
      { regex: /\b(red)\b/i, val: 'Red' },
      { regex: /\b(green)\b/i, val: 'Green' }
    ];

    for (const pat of colorPatterns) {
      const match = combinedSource.match(pat.regex);
      if (match) {
        evidences.push({
          field: 'color',
          proposedValue: pat.val,
          evidenceQuote: match[0],
          confidence: 0.92,
          isUncertain: false,
          reasoning: `Extracted color '${pat.val}' from source title/description.`
        });
        proposedAttributes['color'] = pat.val;
        break;
      }
    }

    // 3. Propose enriched description if missing or short
    let proposedDescription = product.description;
    if (!product.description || product.description.length < 80) {
      const title = product.name;
      const matStr = proposedAttributes['material'] ? ` Constructed with premium ${proposedAttributes['material'].toLowerCase()}.` : '';
      const colStr = proposedAttributes['color'] ? ` Features an elegant ${proposedAttributes['color'].toLowerCase()} finish.` : '';
      
      proposedDescription = `${title} is engineered for durability, everyday comfort, and refined style.${matStr}${colStr} Designed to provide superior quality and fit for demanding daily use.`;
    }

    return {
      proposedDescription,
      proposedAttributes,
      evidences,
      overallConfidence: evidences.some(e => e.isUncertain) ? 0.7 : 0.94
    };
  }
}

/**
 * Gemini Provider connecting to Google AI Studio when GEMINI_API_KEY is configured
 */
export class GeminiAIProvider implements IAIProvider {
  name = 'GeminiAIProvider';
  private apiKey: string;
  private model: string;
  private offlineFallback: OfflineRuleBasedProvider;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.offlineFallback = new OfflineRuleBasedProvider();
  }

  async generateProposal(product: Product): Promise<Partial<AIProposal>> {
    if (!this.apiKey) {
      return this.offlineFallback.generateProposal(product);
    }

    try {
      const prompt = `You are a CatalogIQ PIM enrichment agent. 
Analyze the following product and propose structured attribute values and an improved professional description.

CRITICAL GUARDRAIL:
Every proposed attribute MUST have an exact, verbatim quotation ('evidenceQuote') found inside the title or source text.
If a specification cannot be verified in the source text, mark 'isUncertain: true' and do NOT guess!

Product:
Title: ${product.name}
Existing Short Description: ${product.shortDescription}
Existing Description: ${product.description}
Existing Attributes: ${JSON.stringify(product.attributes)}

Respond ONLY in valid JSON matching this schema:
{
  "proposedDescription": "...",
  "proposedAttributes": { "material": "...", "color": "..." },
  "evidences": [
    {
      "field": "material",
      "proposedValue": "Cotton",
      "evidenceQuote": "100% cotton",
      "confidence": 0.95,
      "isUncertain": false,
      "reasoning": "Found in title"
    }
  ],
  "overallConfidence": 0.9
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) {
        console.warn(`[Gemini Provider] API returned ${res.status}, falling back to offline provider.`);
        return this.offlineFallback.generateProposal(product);
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return this.offlineFallback.generateProposal(product);
      }

      return JSON.parse(text);
    } catch (err) {
      console.warn('[Gemini Provider] Generation failed, falling back to offline provider:', err);
      return this.offlineFallback.generateProposal(product);
    }
  }
}
