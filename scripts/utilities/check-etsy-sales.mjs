// Check latest Etsy sales
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

console.log('\n📊 Latest Etsy Orders:\n');

const sales = db.prepare(`
    SELECT order_id, listing_id, product_name, quantity, sale_price, order_date
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
    ORDER BY id DESC 
    LIMIT 10
`).all();

if (sales.length === 0) {
    console.log('   No Etsy orders found');
} else {
    console.log(`   Found ${sales.length} recent Etsy orders:\n`);
    sales.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.order_id}`);
        console.log(`      Product: ${s.product_name}`);
        console.log(`      Listing ID: ${s.listing_id}`);
        console.log(`      Qty: ${s.quantity} × £${s.sale_price.toFixed(2)} = £${(s.quantity * s.sale_price).toFixed(2)}`);
        console.log(`      Date: ${s.order_date}\n`);
    });
}

// Check total
const total = db.prepare("SELECT COUNT(*) as count FROM Sales WHERE order_id LIKE 'etsy-%'").get();
console.log(`\n📈 Total Etsy orders in database: ${total.count}\n`);
