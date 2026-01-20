// Check for any data integrity issues
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

console.log('\n🔍 Checking for data integrity issues...\n');

// 1. Check for duplicate order_ids
console.log('1. Checking for duplicate order_ids:');
const duplicates = db.prepare(`
    SELECT order_id, COUNT(*) as count
    FROM Sales
    WHERE order_id LIKE 'etsy-%'
    GROUP BY order_id
    HAVING COUNT(*) > 1
`).all();

if (duplicates.length > 0) {
    console.log(`   ⚠️  Found ${duplicates.length} duplicate order IDs!`);
    duplicates.forEach(d => console.log(`      ${d.order_id}: ${d.count} times`));
} else {
    console.log('   ✅ No duplicates found\n');
}

// 2. Show count of Etsy sales by date
console.log('2. Etsy sales by month:');
const byMonth = db.prepare(`
    SELECT 
        strftime('%Y-%m', order_date) as month,
        COUNT(*) as count,
        SUM(sale_price * quantity) as total
    FROM Sales
    WHERE order_id LIKE 'etsy-%'
    GROUP BY month
    ORDER BY month
`).all();

byMonth.forEach(m => {
    console.log(`   ${m.month}: ${m.count} sales, £${m.total.toFixed(2)}`);
});

// 3. Compare with non-Etsy sales
console.log('\n3. Sales breakdown by source:');
const etsyCount = db.prepare("SELECT COUNT(*) as c, SUM(sale_price * quantity) as total FROM Sales WHERE order_id LIKE 'etsy-%'").get();
const otherCount = db.prepare("SELECT COUNT(*) as c, SUM(sale_price * quantity) as total FROM Sales WHERE order_id NOT LIKE 'etsy-%'").get();

console.log(`   Etsy orders: ${etsyCount.c} (£${etsyCount.total.toFixed(2)})`);
console.log(`   Other orders: ${otherCount.c} (£${(otherCount.total || 0).toFixed(2)})`);
console.log(`   Total: ${etsyCount.c + otherCount.c} (£${(etsyCount.total + (otherCount.total || 0)).toFixed(2)})\n`);

// 4. Sample some recent Etsy orders to verify
console.log('4. Sample of 5 recent Etsy orders:');
const samples = db.prepare(`
    SELECT order_id, product_name, quantity, sale_price, order_date
    FROM Sales
    WHERE order_id LIKE 'etsy-%'
    ORDER BY id DESC
    LIMIT 5
`).all();

samples.forEach(s => {
    console.log(`   ${s.order_id}`);
    console.log(`      ${s.product_name}`);
    console.log(`      ${s.quantity} × £${s.sale_price} = £${(s.quantity * s.sale_price).toFixed(2)} on ${s.order_date}\n`);
});
