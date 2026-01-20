import 'dotenv/config';
import database from '../../services/database.js';

const stmt = database.prepare('SELECT * FROM Sales');
const sales = stmt.all();
console.log(`\nTotal sales in database: ${sales.length}`);

const cancelled1 = sales.filter(s => s.order_id.includes('3664474997'));
const cancelled2 = sales.filter(s => s.order_id.includes('3680265954'));

console.log(`\n🔍 Checking for cancelled orders:`);
console.log(`  Receipt 3664474997: ${cancelled1.length > 0 ? '❌ FOUND (should not be here!)' : '✓ Not found (correct!)'}`);
console.log(`  Receipt 3680265954: ${cancelled2.length > 0 ? '❌ FOUND (should not be here!)' : '✓ Not found (correct!)'}`);

console.log(`\n📋 All synced order IDs:`);
sales.forEach(s => console.log(`  - ${s.order_id}`));
