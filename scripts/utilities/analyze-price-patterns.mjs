// Let's examine if the issue is that transaction.price might include shipping or other costs
// Show detailed breakdown of what's in our database

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

console.log('\n💡 Price Analysis - Looking for patterns:\n');

// Get all Etsy sales with their details
const sales = db.prepare(`
    SELECT order_id, listing_id, product_name, quantity, sale_price, order_date
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
    ORDER BY order_date
`).all();

console.log(`Total Etsy sales: ${sales.length}\n`);

// Group by receipt_id to see if multi-item orders show suspicious patterns
const byReceipt = {};
sales.forEach(sale => {
    const receiptId = sale.order_id.split('-')[1];
    if (!byReceipt[receiptId]) {
        byReceipt[receiptId] = [];
    }
    byReceipt[receiptId].push(sale);
});

console.log('Analysis of orders:\n');

let totalValue = 0;
let suspiciousCount = 0;

for (const [receiptId, items] of Object.entries(byReceipt)) {
    const receiptTotal = items.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);
    totalValue += receiptTotal;
    
    if (items.length > 1) {
        console.log(`📦 Multi-item order ${receiptId}:`);
        items.forEach(item => {
            console.log(`   - ${item.product_name.substring(0, 50)}...`);
            console.log(`     Price: £${item.sale_price.toFixed(2)}`);
        });
        console.log(`   Subtotal: £${receiptTotal.toFixed(2)}\n`);
    }
    
    // Check for suspiciously high prices (over £1000)
    items.forEach(item => {
        if (item.sale_price > 1000) {
            suspiciousCount++;
            console.log(`⚠️  High price alert:`);
            console.log(`   ${item.order_id}`);
            console.log(`   ${item.product_name}`);
            console.log(`   £${item.sale_price.toFixed(2)}\n`);
        }
    });
}

console.log(`\n📊 Summary:`);
console.log(`   Total orders (receipts): ${Object.keys(byReceipt).length}`);
console.log(`   Total line items: ${sales.length}`);
console.log(`   Multi-item orders: ${Object.values(byReceipt).filter(items => items.length > 1).length}`);
console.log(`   Items over £1000: ${suspiciousCount}`);
console.log(`   Total value: £${totalValue.toFixed(2)}`);
console.log(`   Average per line item: £${(totalValue / sales.length).toFixed(2)}`);
console.log(`   Average per order: £${(totalValue / Object.keys(byReceipt).length).toFixed(2)}\n`);

// What would the total be if we removed items over £1000?
const withoutHigh = sales.filter(s => s.sale_price <= 1000);
const normalTotal = withoutHigh.reduce((sum, s) => sum + (s.sale_price * s.quantity), 0);
console.log(`If we exclude items over £1000:`);
console.log(`   Remaining: ${withoutHigh.length} items`);
console.log(`   Total: £${normalTotal.toFixed(2)}`);
console.log(`   Average: £${(normalTotal / withoutHigh.length).toFixed(2)}\n`);
