const BASE_URL = '/api';

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let errMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.error) errMessage = body.error;
      else if (body.message) errMessage = body.message;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  return response.json();
}

export const api = {
  // Quality & Dashboard
  getQualitySummary: () => apiRequest('/quality/summary'),

  // Products
  getProducts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiRequest(`/products${qs}`);
  },
  getProduct: (id: string) => apiRequest(`/products/${id}`),
  createProduct: (data: any) => apiRequest('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
  getProductVersions: (id: string) => apiRequest(`/products/${id}/versions`),
  restoreProductVersion: (id: string, versionNumber: number) =>
    apiRequest(`/products/${id}/restore-version/${versionNumber}`, { method: 'POST' }),

  // Attributes & Variations
  getAttributes: () => apiRequest('/attributes'),
  createAttribute: (data: any) => apiRequest('/attributes', { method: 'POST', body: JSON.stringify(data) }),
  deleteAttribute: (id: string) => apiRequest(`/attributes/${id}`, { method: 'DELETE' }),
  createProductType: (data: any) => apiRequest('/attributes/product-types', { method: 'POST', body: JSON.stringify(data) }),
  deleteProductType: (id: string) => apiRequest(`/attributes/product-types/${id}`, { method: 'DELETE' }),
  generateVariations: (data: any) =>
    apiRequest('/attributes/generate-variations', { method: 'POST', body: JSON.stringify(data) }),

  // Sync Operations
  publishProduct: (id: string) => apiRequest(`/sync/publish/${id}`, { method: 'POST' }),
  publishBatch: (productIds: string[]) =>
    apiRequest('/sync/publish-batch', { method: 'POST', body: JSON.stringify({ productIds }) }),
  getSyncJobs: () => apiRequest('/sync/jobs'),
  retrySyncJob: (jobId: string) => apiRequest(`/sync/retry/${jobId}`, { method: 'POST' }),
  getSyncLogs: (productId?: string) => {
    const qs = productId ? `?productId=${productId}` : '';
    return apiRequest(`/sync/logs${qs}`);
  },

  // AI Agent & Proposals
  runAiScan: (productIds?: string[]) =>
    apiRequest('/ai/scan', { method: 'POST', body: JSON.stringify({ productIds }) }),
  getAiProposals: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return apiRequest(`/ai/proposals${qs}`);
  },
  approveProposal: (id: string) => apiRequest(`/ai/proposals/${id}/approve`, { method: 'POST' }),
  rejectProposal: (id: string, reason?: string) =>
    apiRequest(`/ai/proposals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  bulkApproveProposals: (proposalIds: string[]) =>
    apiRequest('/ai/proposals/bulk-approve', { method: 'POST', body: JSON.stringify({ proposalIds }) }),

  // Store Connection & Mock Controls
  getStoreConfig: () => apiRequest('/store/config'),
  saveStoreConfig: (data: any) => apiRequest('/store/config', { method: 'POST', body: JSON.stringify(data) }),
  testStoreConnection: (data?: any) => apiRequest('/store/test', { method: 'POST', body: JSON.stringify(data || {}) }),
  importFromStore: () => apiRequest('/store/import', { method: 'POST' }),

  // Mock WooCommerce Server Direct Controls
  getMockStatus: async () => {
    try {
      const res = await fetch('http://localhost:5050/api/mock-control/status');
      return res.json();
    } catch {
      return null;
    }
  },
  configureMockFailure: async (data: any) => {
    try {
      const res = await fetch('http://localhost:5050/api/mock-control/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } catch (e: any) {
      throw new Error('Mock store is not currently reachable');
    }
  },
  resetMockStore: async () => {
    try {
      const res = await fetch('http://localhost:5050/api/mock-control/reset', { method: 'POST' });
      return res.json();
    } catch {
      return null;
    }
  }
};
