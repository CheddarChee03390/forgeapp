// Analyze Etsy sales to see if prices look reasonable
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

console.log('\n📊 Etsy Sales Analysis:\n');

const sales = db.prepare(`
    SELECT order_id, product_name, quantity, sale_price, (quantity * sale_price) as line_total
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
    ORDER BY sale_price DESC
    LIMIT 15
`).all();

console.log('Top 15 highest-priced sales:\n');
sales.forEach((s, i) => {
    console.log(`${i + 1}. ${s.order_id}`);
    console.log(`   Product: ${s.product_name}`);
    console.log(`   Unit Price: £${s.sale_price.toFixed(2)}`);
    console.log(`   Quantity: ${s.quantity}`);
    console.log(`   Line Total: £${s.line_total.toFixed(2)}\n`);
});

// Statistics
const stats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        AVG(sale_price) as avg_price,
        MIN(sale_price) as min_price,
        MAX(sale_price) as max_price,
        SUM(sale_price * quantity) as total_value
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
`).get();

console.log('📈 Statistics:');
console.log(`   Total Sales: ${stats.count}`);
console.log(`   Average Price: £${stats.avg_price.toFixed(2)}`);
console.log(`   Min Price: £${stats.min_price.toFixed(2)}`);
console.log(`   Max Price: £${stats.max_price.toFixed(2)}`);
console.log(`   Total Value: £${stats.total_value.toFixed(2)}\n`);
