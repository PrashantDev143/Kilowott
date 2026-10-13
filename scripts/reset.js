const { execSync } = require('child_process');
const path = require('path');

console.log('[Reset] Resetting CatalogIQ database and mock WooCommerce store to baseline...');

// 1. Run seed script
require('./seed.js');

// 2. Trigger mock store reset if running
try {
  fetch('http://localhost:5050/api/mock-control/reset', { method: 'POST' })
    .then(() => console.log('[Reset] Reset mock WooCommerce store.'))
    .catch(() => console.log('[Reset] Mock store not currently running, skipping mock reset.'));
} catch (e) {
  // ignore
}

console.log('[Reset] CatalogIQ environment successfully reset.');
