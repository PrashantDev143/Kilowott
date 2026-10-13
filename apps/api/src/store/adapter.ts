export interface StoreTestResult {
  success: boolean;
  version?: string;
  wpVersion?: string;
  error?: string;
}

export interface IStoreAdapter {
  testConnection(): Promise<StoreTestResult>;
  getProducts(params?: { perPage?: number; page?: number; sku?: string }): Promise<any[]>;
  getProduct(id: number): Promise<any>;
  findProductBySku(sku: string): Promise<any | null>;
  createProduct(data: any): Promise<any>;
  updateProduct(id: number, data: any): Promise<any>;
  batchSync(payload: { create?: any[]; update?: any[]; delete?: number[] }): Promise<any>;
}
