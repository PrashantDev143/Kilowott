import { SyncStatus } from '@catalogiq/shared';

export class InvalidStateTransitionError extends Error {
  constructor(from: SyncStatus, to: SyncStatus) {
    super(`Illegal state transition from '${from}' to '${to}'.`);
    this.name = 'InvalidStateTransitionError';
  }
}

const ALLOWED_TRANSITIONS: Record<SyncStatus, SyncStatus[]> = {
  draft: ['pending'],
  pending: ['syncing', 'failed'],
  syncing: ['synced', 'failed', 'pending'], // pending for retry loop
  synced: ['draft', 'conflict', 'pending'],
  failed: ['pending', 'draft'],
  conflict: ['pending', 'synced', 'draft']
};

export function canTransition(from: SyncStatus, to: SyncStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertTransition(from: SyncStatus, to: SyncStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
