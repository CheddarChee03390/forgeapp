// Check for duplicate prices in multi-item receipts
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

console.log('\n🔍 Checking for duplicate prices in multi-item orders...\n');

// Find receipts with multiple transactions
const multiItemOrders = db.prepare(`
    SELECT 
        SUBSTR(order_id, 6, INSTR(SUBSTR(order_id, 6), '-') - 1) as receipt_id,
        COUNT(*) as item_count,
        GROUP_CONCAT(order_id) as order_ids,
        GROUP_CONCAT(sale_price) as prices,
        GROUP_CONCAT(product_name, ' | ') as products
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
    GROUP BY receipt_id
    HAVING COUNT(*) > 1
`).all();

if (multiItemOrders.length === 0) {
    console.log('   No multi-item orders found\n');
} else {
    console.log(`   Found ${multiItemOrders.length} orders with multiple items:\n`);
    
    for (const order of multiItemOrders) {
        const orderIds = order.order_ids.split(',');
        const prices = order.prices.split(',').map(p => parseFloat(p));
        const products = order.products.split(' | ');
        
        console.log(`📦 Receipt: ${order.receipt_id} (${order.item_count} items)`);
        
        // Check if all prices are the same (potential duplicate)
        const uniquePrices = [...new Set(prices)];
        if (uniquePrices.length === 1) {
            console.log('   ⚠️  WARNING: All items have the same price - possible duplicate!');
        }
        
        orderIds.forEach((id, i) => {
            console.log(`   ${i + 1}. ${id}`);
            console.log(`      Product: ${products[i]}`);
            console.log(`      Price: £${prices[i].toFixed(2)}`);
        });
        
        const total = prices.reduce((sum, p) => sum + p, 0);
        console.log(`   Total: £${total.toFixed(2)}\n`);
    }
}

// Show total sales value
const totalValue = db.prepare("SELECT SUM(sale_price * quantity) as total FROM Sales WHERE order_id LIKE 'etsy-%'").get();
console.log(`💰 Total Etsy sales value: £${totalValue.total.toFixed(2)}\n`);
