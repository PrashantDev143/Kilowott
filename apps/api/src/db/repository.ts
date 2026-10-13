import fs from 'fs';
import path from 'path';
import {
  Product,
  ProductVersion,
  AttributeDefinition,
  ProductType,
  SyncJob,
  SyncLog,
  AIProposal,
  StoreConnectionConfig
} from '@catalogiq/shared';

interface DatabaseState {
  products: Product[];
  versions: ProductVersion[];
  attributes: AttributeDefinition[];
  productTypes: ProductType[];
  syncJobs: SyncJob[];
  syncLogs: SyncLog[];
  aiProposals: AIProposal[];
  storeConfig: StoreConnectionConfig;
}

export class JsonRepository {
  private filePath: string;
  private state: DatabaseState;

  constructor(filePath?: string) {
    this.filePath = filePath || this.resolveDbPath();
    this.state = this.loadState();
  }

  private resolveDbPath(): string {
    if (process.env.DB_FILE_PATH && fs.existsSync(process.env.DB_FILE_PATH)) {
      return path.resolve(process.env.DB_FILE_PATH);
    }
    const candidates = [
      path.resolve(process.cwd(), 'data', 'catalogiq-db.json'),
      path.resolve(process.cwd(), '../data', 'catalogiq-db.json'),
      path.resolve(__dirname, '../../../../data/catalogiq-db.json'),
      path.resolve(__dirname, '../../../data/catalogiq-db.json'),
      path.resolve(__dirname, '../../data/catalogiq-db.json')
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
    return candidates[0];
  }

  private loadState(): DatabaseState {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('[Repository] Could not read existing DB file, initializing fresh state.');
    }

    return {
      products: [],
      versions: [],
      attributes: [],
      productTypes: [],
      syncJobs: [],
      syncLogs: [],
      aiProposals: [],
      storeConfig: {
        storeUrl: process.env.WOO_STORE_URL || 'http://localhost:5050',
        consumerKey: process.env.WOO_CONSUMER_KEY || 'ck_mock_catalogiq_key',
        consumerSecret: process.env.WOO_CONSUMER_SECRET || 'cs_mock_catalogiq_secret',
        webhookSecret: process.env.WOO_WEBHOOK_SECRET || 'mock_webhook_secret_12345',
        mode: (process.env.STORE_MODE as any) || 'mock'
      }
    };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[Repository] Failed to write database state:', err);
    }
  }

  // ----------------------------------------
  // Product Operations
  // ----------------------------------------
  getProducts(): Product[] {
    return [...this.state.products];
  }

  getProductById(id: string): Product | null {
    return this.state.products.find(p => p.id === id) || null;
  }

  getProductBySku(sku: string): Product | null {
    return this.state.products.find(p => p.sku.toLowerCase() === sku.toLowerCase()) || null;
  }

  getProductByWooId(wooId: number): Product | null {
    return this.state.products.find(p => p.wooId === wooId) || null;
  }

  saveProduct(product: Product, changeSummary = 'Updated product'): Product {
    const existingIndex = this.state.products.findIndex(p => p.id === product.id);
    let updatedProduct: Product;

    if (existingIndex >= 0) {
      const existing = this.state.products[existingIndex];
      const newVersion = existing.currentVersion + 1;
      updatedProduct = {
        ...product,
        currentVersion: newVersion,
        updatedAt: new Date().toISOString()
      };
      this.state.products[existingIndex] = updatedProduct;

      // Save immutable version snapshot
      this.state.versions.push({
        id: `ver-${product.id}-${newVersion}`,
        productId: product.id,
        versionNumber: newVersion,
        snapshot: updatedProduct,
        changeSummary,
        createdAt: new Date().toISOString()
      });
    } else {
      updatedProduct = {
        ...product,
        currentVersion: 1,
        createdAt: product.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.products.push(updatedProduct);

      this.state.versions.push({
        id: `ver-${product.id}-1`,
        productId: product.id,
        versionNumber: 1,
        snapshot: updatedProduct,
        changeSummary: 'Created initial product',
        createdAt: new Date().toISOString()
      });
    }

    this.persist();
    return updatedProduct;
  }

  deleteProduct(id: string): boolean {
    const initialLen = this.state.products.length;
    this.state.products = this.state.products.filter(p => p.id !== id);
    if (this.state.products.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  getProductVersions(productId: string): ProductVersion[] {
    return this.state.versions
      .filter(v => v.productId === productId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  // ----------------------------------------
  // Attribute & Type Operations
  // ----------------------------------------
  getAttributes(): AttributeDefinition[] {
    return [...this.state.attributes];
  }

  saveAttribute(attr: AttributeDefinition): AttributeDefinition {
    const idx = this.state.attributes.findIndex(a => a.id === attr.id);
    if (idx >= 0) {
      this.state.attributes[idx] = attr;
    } else {
      this.state.attributes.push(attr);
    }
    this.persist();
    return attr;
  }

  deleteAttribute(id: string): boolean {
    this.state.attributes = this.state.attributes.filter(a => a.id !== id);
    this.persist();
    return true;
  }

  getProductTypes(): ProductType[] {
    return [...this.state.productTypes];
  }

  saveProductType(pType: ProductType): ProductType {
    const idx = this.state.productTypes.findIndex(t => t.id === pType.id);
    if (idx >= 0) {
      this.state.productTypes[idx] = pType;
    } else {
      this.state.productTypes.push(pType);
    }
    this.persist();
    return pType;
  }

  deleteProductType(id: string): boolean {
    this.state.productTypes = this.state.productTypes.filter(t => t.id !== id);
    this.persist();
    return true;
  }

  // ----------------------------------------
  // Sync Jobs & Logs Operations
  // ----------------------------------------
  getSyncJobs(): SyncJob[] {
    return [...this.state.syncJobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getSyncJobById(id: string): SyncJob | null {
    return this.state.syncJobs.find(j => j.id === id) || null;
  }

  saveSyncJob(job: SyncJob): SyncJob {
    const idx = this.state.syncJobs.findIndex(j => j.id === job.id);
    if (idx >= 0) {
      this.state.syncJobs[idx] = job;
    } else {
      this.state.syncJobs.push(job);
    }
    this.persist();
    return job;
  }

  getPendingSyncJobs(): SyncJob[] {
    const now = new Date().toISOString();
    return this.state.syncJobs.filter(j => {
      if (j.status === 'pending') return true;
      if (j.status === 'retrying' && j.nextRetryAt && j.nextRetryAt <= now) return true;
      return false;
    });
  }

  addSyncLog(log: SyncLog): void {
    this.state.syncLogs.push(log);
    this.persist();
  }

  getSyncLogs(productId?: string): SyncLog[] {
    let logs = [...this.state.syncLogs];
    if (productId) {
      logs = logs.filter(l => l.productId === productId);
    }
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ----------------------------------------
  // AI Proposals Operations
  // ----------------------------------------
  getAIProposals(): AIProposal[] {
    return [...this.state.aiProposals].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getAIProposalById(id: string): AIProposal | null {
    return this.state.aiProposals.find(p => p.id === id) || null;
  }

  saveAIProposal(proposal: AIProposal): AIProposal {
    const idx = this.state.aiProposals.findIndex(p => p.id === proposal.id);
    if (idx >= 0) {
      this.state.aiProposals[idx] = proposal;
    } else {
      this.state.aiProposals.push(proposal);
    }
    this.persist();
    return proposal;
  }

  deleteAIProposal(id: string): boolean {
    this.state.aiProposals = this.state.aiProposals.filter(p => p.id !== id);
    this.persist();
    return true;
  }

  // ----------------------------------------
  // Store Settings
  // ----------------------------------------
  getStoreConfig(): StoreConnectionConfig {
    return { ...this.state.storeConfig };
  }

  saveStoreConfig(cfg: StoreConnectionConfig): StoreConnectionConfig {
    this.state.storeConfig = { ...cfg };
    this.persist();
    return this.state.storeConfig;
  }

  // Reset entire database to blank
  resetAll(initialProducts: Product[] = [], initialAttrs: AttributeDefinition[] = [], initialTypes: ProductType[] = []): void {
    this.state = {
      products: initialProducts,
      versions: initialProducts.map(p => ({
        id: `ver-${p.id}-1`,
        productId: p.id,
        versionNumber: 1,
        snapshot: p,
        changeSummary: 'Seed initial product',
        createdAt: new Date().toISOString()
      })),
      attributes: initialAttrs,
      productTypes: initialTypes,
      syncJobs: [],
      syncLogs: [],
      aiProposals: [],
      storeConfig: this.state.storeConfig
    };
    this.persist();
  }
}

// Singleton repository instance
export const db = new JsonRepository();
