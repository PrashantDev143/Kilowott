import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition, InvalidStateTransitionError } from '../src/sync/stateMachine';
import { evaluateRetry } from '../src/sync/backoff';
import { verifyReadBack } from '../src/sync/readBack';
import { Product } from '@catalogiq/shared';

describe('Sync Engine & State Machine', () => {
  it('allows valid state transitions', () => {
    expect(canTransition('draft', 'pending')).toBe(true);
    expect(canTransition('pending', 'syncing')).toBe(true);
    expect(canTransition('syncing', 'synced')).toBe(true);
    expect(canTransition('synced', 'draft')).toBe(true);
    expect(canTransition('failed', 'pending')).toBe(true);
  });

  it('rejects illegal state transitions', () => {
    expect(canTransition('draft', 'synced')).toBe(false);
    expect(canTransition('draft', 'syncing')).toBe(false);
    expect(() => assertTransition('draft', 'synced')).toThrow(InvalidStateTransitionError);
  });

  it('calculates exponential backoff for retryable 500 errors', () => {
    const err500 = { status: 500, message: 'Internal server error' };
    const decision1 = evaluateRetry(1, 5, err500);
    expect(decision1.isRetryable).toBe(true);
    expect(decision1.delayMs).toBeGreaterThanOrEqual(1500);

    const decision2 = evaluateRetry(2, 5, err500);
    expect(decision2.isRetryable).toBe(true);
    expect(decision2.delayMs).toBeGreaterThan(decision1.delayMs);
  });

  it('fails permanently on 400 validation error without retries', () => {
    const err400 = { status: 400, message: 'Invalid SKU' };
    const decision = evaluateRetry(1, 5, err400);
    expect(decision.isRetryable).toBe(false);
  });

  it('confirms matches during read-back verification', () => {
    const p: any = { sku: 'TEST-SKU', price: 49.99, name: 'Shirt' };
    const storeResponse = { sku: 'TEST-SKU', price: '49.99', name: 'Shirt' };

    const check = verifyReadBack(p, storeResponse);
    expect(check.matches).toBe(true);
    expect(check.differences.length).toBe(0);
  });

  it('detects discrepancies during read-back verification', () => {
    const p: any = { sku: 'TEST-SKU', price: 49.99, name: 'Shirt' };
    const storeResponse = { sku: 'WRONG-SKU', price: '20.00', name: 'Other' };

    const check = verifyReadBack(p, storeResponse);
    expect(check.matches).toBe(false);
    expect(check.differences.length).toBeGreaterThan(0);
  });
});
