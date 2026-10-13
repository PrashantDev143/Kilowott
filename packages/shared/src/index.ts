import { z } from 'zod';

// ==========================================
// 1. Sync State Machine Enums & Types
// ==========================================
export const SyncStatusSchema = z.enum([
  'draft',
  'pending',
  'syncing',
  'synced',
  'failed',
  'conflict'
]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const QualityBandSchema = z.enum(['Healthy', 'Needs work', 'Poor']);
export type QualityBand = z.infer<typeof QualityBandSchema>;

// ==========================================
// 2. Attribute & Product Type Models
// ==========================================
export const AttributeDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(['select', 'text', 'number']),
  allowedValues: z.array(z.string()).default([]),
  isRequired: z.boolean().default(false),
  wooAttributeId: z.number().optional()
});
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;

export const ProductTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  attributeIds: z.array(z.string()).default([])
});
export type ProductType = z.infer<typeof ProductTypeSchema>;

export const VariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  price: z.number(),
  attributes: z.record(z.string()), // e.g. { size: "10", color: "Black" }
  wooVariantId: z.number().optional()
});
export type Variant = z.infer<typeof VariantSchema>;

// ==========================================
// 3. Product & Version Models
// ==========================================
export const ProductImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  altText: z.string().default(''),
  position: z.number().default(0)
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  wooId: z.number().nullable().optional(),
  name: z.string(),
  sku: z.string(),
  price: z.number(),
  description: z.string().default(''),
  shortDescription: z.string().default(''),
  categories: z.array(z.string()).default([]),
  status: z.enum(['publish', 'draft', 'pending']).default('draft'),
  syncStatus: SyncStatusSchema.default('draft'),
  productTypeId: z.string().nullable().optional(),
  attributes: z.record(z.string()).default({}), // e.g. { material: "100% Cotton" }
  images: z.array(ProductImageSchema).default([]),
  variants: z.array(VariantSchema).default([]),
  qualityScore: z.number().min(0).max(100).default(100),
  currentVersion: z.number().default(1),
  lastSyncedAt: z.string().nullable().optional(),
  lastSyncError: z.string().nullable().optional(),
  conflictDetails: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductVersionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  versionNumber: z.number(),
  snapshot: ProductSchema,
  changeSummary: z.string().default('Manual update'),
  createdAt: z.string()
});
export type ProductVersion = z.infer<typeof ProductVersionSchema>;

// ==========================================
// 4. Quality Engine Models (Rules Q01-Q12)
// ==========================================
export const QualityViolationSchema = z.object({
  ruleId: z.string(), // e.g. Q01, Q05
  severity: z.enum(['Critical', 'Major', 'Minor']),
  deduction: z.number(),
  field: z.string(),
  message: z.string(),
  canAiFix: z.boolean().default(false)
});
export type QualityViolation = z.infer<typeof QualityViolationSchema>;

export const QualityScoreResultSchema = z.object({
  score: z.number().min(0).max(100),
  band: QualityBandSchema,
  violations: z.array(QualityViolationSchema)
});
export type QualityScoreResult = z.infer<typeof QualityScoreResultSchema>;

// ==========================================
// 5. AI Proposals & Evidence Models
// ==========================================
export const ProposalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'uncertain']);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const AIEvidenceSchema = z.object({
  field: z.string(),
  proposedValue: z.string(),
  evidenceQuote: z.string(), // verbatim excerpt from title or description
  confidence: z.number().min(0).max(1),
  isUncertain: z.boolean().default(false),
  reasoning: z.string().optional()
});
export type AIEvidence = z.infer<typeof AIEvidenceSchema>;

export const AIProposalSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  originalDescription: z.string(),
  proposedDescription: z.string().optional(),
  originalAttributes: z.record(z.string()).default({}),
  proposedAttributes: z.record(z.string()).default({}),
  evidences: z.array(AIEvidenceSchema),
  overallConfidence: z.number().min(0).max(1),
  status: ProposalStatusSchema.default('pending'),
  reviewNote: z.string().optional(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable().optional()
});
export type AIProposal = z.infer<typeof AIProposalSchema>;

// ==========================================
// 6. Sync Jobs & Audit Logs
// ==========================================
export const SyncJobSchema = z.object({
  id: z.string(),
  productId: z.string(),
  operation: z.enum(['create', 'update', 'delete', 'batch']),
  status: z.enum(['pending', 'syncing', 'completed', 'failed', 'retrying']),
  attempts: z.number().default(0),
  maxAttempts: z.number().default(5),
  nextRetryAt: z.string().nullable().optional(),
  idempotencyKey: z.string(),
  error: z.string().nullable().optional(),
  payload: z.record(z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type SyncJob = z.infer<typeof SyncJobSchema>;

export const SyncLogSchema = z.object({
  id: z.string(),
  jobId: z.string().optional(),
  productId: z.string(),
  action: z.string(),
  attempt: z.number(),
  requestSummary: z.string(),
  responseStatus: z.number().optional(),
  responseSummary: z.string(),
  errorCauseCode: z.string().nullable().optional(),
  errorCauseMessage: z.string().nullable().optional(),
  isSuccess: z.boolean(),
  createdAt: z.string()
});
export type SyncLog = z.infer<typeof SyncLogSchema>;

// ==========================================
// 7. Store Connection & Webhooks
// ==========================================
export const StoreConnectionConfigSchema = z.object({
  storeUrl: z.string().url(),
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
  webhookSecret: z.string().optional(),
  mode: z.enum(['mock', 'live']).default('mock')
});
export type StoreConnectionConfig = z.infer<typeof StoreConnectionConfigSchema>;

export const WebhookEventSchema = z.object({
  id: z.string(),
  deliveryId: z.string(),
  topic: z.string(), // product.created, product.updated, product.deleted
  payload: z.record(z.any()),
  processed: z.boolean().default(false),
  receivedAt: z.string()
});
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
