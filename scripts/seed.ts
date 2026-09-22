/**
 * Builds (or rebuilds) the demo tenant.
 *   npm run seed     — create it if missing
 *   npm run reset    — wipe .data and rebuild from scratch
 */
import { seedDemo } from '../src/lib/demo/seed';

const force = process.argv.includes('--force');
const result = seedDemo({ force });

if (result.counts.skipped) {
  console.log('Demo tenant already exists. Re-run with --force to rebuild it.');
} else {
  console.log('Demo tenant created.');
  console.table(result.counts);
}
console.log(`\n  Sign in:  ${result.email}\n  Password: ${result.password}\n`);
