import { IStoreAdapter, StoreTestResult } from './adapter';

export function redactSecrets(text: string, secrets: (string | undefined | null)[]): string {
  if (!text || typeof text !== 'string') return text || '';
  let result = text;
  for (const s of secrets) {
    if (s && typeof s === 'string' && s.trim().length >= 3) {
      result = result.split(s).join('***');
    }
  }
  return result;
}

export class WooCommerceClient implements IStoreAdapter {
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;

  constructor(baseUrl: string, consumerKey: string, consumerSecret: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status} ${response.statusText}`;
        let errBody: any = null;
        try {
          errBody = await response.json();
          if (errBody && errBody.message) {
            errMessage = errBody.message;
          }
        } catch {
          // ignore json parse error
        }

        const error: any = new Error(errMessage);
        error.status = response.status;
        error.response = errBody;
        throw error;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      // Redact credentials safely without masking error when keys are empty
      const secrets = [this.consumerKey, this.consumerSecret];
      if (err.message) {
        err.message = redactSecrets(err.message, secrets);
      }
      if (err.cause && typeof err.cause === 'object' && err.cause.message) {
        err.cause.message = redactSecrets(err.cause.message, secrets);
      }
      throw err;
    }
  }

  async testConnection(): Promise<StoreTestResult> {
    try {
      const data: any = await this.request('/wp-json/wc/v3/system_status');
      return {
        success: true,
        version: data?.environment?.version || 'Unknown',
        wpVersion: data?.environment?.wp_version || 'Unknown'
      };
    } catch (err: any) {
      const secrets = [this.consumerKey, this.consumerSecret];
      const baseErr = redactSecrets(err.message || 'Failed to connect to WooCommerce store', secrets);
      const causeCode = err.cause?.code;
      const causeMsg = err.cause?.message ? redactSecrets(err.cause.message, secrets) : null;
      const detailedErr = causeMsg ? `${baseErr} (${causeCode ? `[${causeCode}] ` : ''}${causeMsg})` : baseErr;
      return {
        success: false,
        error: detailedErr
      };
    }
  }

  async getProducts(params?: { perPage?: number; page?: number; sku?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.perPage) query.set('per_page', params.perPage.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.sku) query.set('sku', params.sku);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/wp-json/wc/v3/products${queryString}`);
  }

  async getProduct(id: number): Promise<any> {
    return this.request(`/wp-json/wc/v3/products/${id}`);
  }

  async findProductBySku(sku: string): Promise<any | null> {
    const products = await this.getProducts({ sku, perPage: 1 });
    return products.length > 0 ? products[0] : null;
  }

  async createProduct(data: any): Promise<any> {
    return this.request('/wp-json/wc/v3/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProduct(id: number, data: any): Promise<any> {
    return this.request(`/wp-json/wc/v3/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async batchSync(payload: { create?: any[]; update?: any[]; delete?: number[] }): Promise<any> {
    return this.request('/wp-json/wc/v3/products/batch', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}
