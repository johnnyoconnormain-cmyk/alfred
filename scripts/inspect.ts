/**
 * Ad-hoc read-only look at the local database.
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/inspect.ts
 */
import { all, one } from '../src/lib/db';

const business = one<{ id: string; name: string }>('SELECT id, name FROM businesses WHERE is_demo = 1');
console.log('demo business:', business?.name ?? 'none');
console.log('leads:', all(`SELECT status, COUNT(*) n FROM leads GROUP BY status`));
console.log('quotes:', all(`SELECT status, COUNT(*) n, SUM(total) v FROM quotes GROUP BY status`));
console.log('jobs:', all(`SELECT status, COUNT(*) n FROM jobs GROUP BY status`));
console.log('collected by week:', all(
  `SELECT strftime('%Y-W%W', created_at) w, COUNT(*) n, SUM(amount) v FROM payments GROUP BY w ORDER BY w`,
));
console.log('outstanding:', one(`SELECT COUNT(*) n, SUM(amount - amount_paid) v FROM invoices WHERE status = 'sent'`));
console.log('queued automations:', one(`SELECT COUNT(*) n FROM automation_tasks WHERE status = 'pending'`));
