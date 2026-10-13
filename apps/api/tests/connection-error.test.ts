import { describe, it, expect, beforeEach } from 'vitest';
import { redactSecrets, WooCommerceClient } from '../src/store/wooCommerceClient';
import { SyncWorker } from '../src/jobs/worker';
import { db } from '../src/db/repository';

describe('Connection Error Handling & Cause Recording', () => {
  describe('Secret Redaction', () => {
    it('does not prepend asterisks when consumer keys are empty strings', () => {
      // Regression test for "******fetch failed" bug
      const emptyKey = '';
      const emptySecret = '';
      const result = redactSecrets('fetch failed', [emptyKey, emptySecret]);
      expect(result).toBe('fetch failed');
      expect(result.startsWith('***')).toBe(false);
    });

    it('safely redacts real credentials from error messages', () => {
      const realKey = 'ck_test1234567890';
      const realSecret = 'cs_secret987654321';
      const rawError = `Failed connecting to https://store.test with key ${realKey} and secret ${realSecret}`;
      
      const redacted = redactSecrets(rawError, [realKey, realSecret]);
      expect(redacted).not.toContain(realKey);
      expect(redacted).not.toContain(realSecret);
      expect(redacted).toContain('***');
    });
  });

  describe('Real Error Cause Recording in SyncWorker & WooCommerceClient', () => {
    it('records real error.cause.code and error.cause.message in sync_logs', async () => {
      const worker = new SyncWorker();

      // Seed a test product
      const testProduct: any = {
        id: 'test-conn-p1',
        name: 'Test Connectivity Item',
        sku: 'TEST-CONN-001',
        price: 35.0,
        regularPrice: 35.0,
        description: 'Test connectivity error logging',
        shortDescription: 'Short test',
        categories: ['T-shirts'],
        images: [],
        attributes: {},
        syncStatus: 'pending',
        qualityScore: 95
      };
      db.saveProduct(testProduct, 'Test seed');

      // Create a test sync job
      const testJob: any = {
        id: 'test-job-conn-1',
        productId: testProduct.id,
        operation: 'create',
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
        idempotencyKey: 'test-idem-key-conn-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.saveSyncJob(testJob);

      // Mock getClient on worker to throw an error with real cause
      const simulatedCauseError: any = new TypeError('fetch failed');
      simulatedCauseError.cause = {
        code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
        message: 'self-signed certificate in certificate chain'
      };

      (worker as any).getClient = () => ({
        findProductBySku: async () => {
          throw simulatedCauseError;
        },
        createProduct: async () => {
          throw simulatedCauseError;
        }
      });

      // Execute job
      await worker.executeJob(testJob);

      // Verify sync log was added with errorCauseCode and errorCauseMessage
      const logs = db.getSyncLogs().filter(l => l.jobId === testJob.id);
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[logs.length - 1];
      expect(latestLog.isSuccess).toBe(false);
      expect(latestLog.errorCauseCode).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
      expect(latestLog.errorCauseMessage).toContain('self-signed certificate');
      expect(latestLog.responseSummary).toContain('[DEPTH_ZERO_SELF_SIGNED_CERT]');
      expect(latestLog.responseSummary).toContain('fetch failed');

      // Verify job status and error
      const updatedJob = db.getSyncJobById(testJob.id);
      expect(updatedJob?.status).toBe('retrying');
      expect(updatedJob?.error).toContain('DEPTH_ZERO_SELF_SIGNED_CERT');
    });

    it('returns real cause code in WooCommerceClient testConnection failure', async () => {
      const originalFetch = globalThis.fetch;
      const fakeError: any = new TypeError('fetch failed');
      fakeError.cause = { code: 'DEPTH_ZERO_SELF_SIGNED_CERT', message: 'self-signed certificate' };
      globalThis.fetch = (async () => { throw fakeError; }) as any;

      try {
        const client = new WooCommerceClient('https://catlogue.local', 'ck_my_secret_key', 'cs_my_secret_pwd');
        const res = await client.testConnection();
        expect(res.success).toBe(false);
        expect(res.error).toContain('DEPTH_ZERO_SELF_SIGNED_CERT');
        expect(res.error).toContain('self-signed certificate');
        expect(res.error).not.toContain('ck_my_secret_key');
        expect(res.error).not.toContain('cs_my_secret_pwd');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
