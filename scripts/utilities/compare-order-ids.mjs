/**
 * Compare Order IDs: Etsy Export vs Database
 * Identifies discrepancies between the official Etsy export and what's in the database
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the Etsy export file
const exportFilePath = path.join(__dirname, '../../Order Id check.txt');
const exportContent = fs.readFileSync(exportFilePath, 'utf-8');
const etsy_export_ids = exportContent
    .split('\n')
    .map(id => id.trim())
    .filter(id => id && !id.startsWith('```'));

console.log(`📊 ETSY ORDER ID COMPARISON`);
console.log(`============================\n`);
console.log(`✓ Loaded ${etsy_export_ids.length} order IDs from Etsy export (April 2025 - Present)\n`);

// Open database
const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

// Get all receipt IDs currently in database
const dbRows = db.prepare('SELECT order_id FROM Sales').all();
// Extract just the receipt ID from format like "etsy-3652067906-4559875443"
const db_order_ids = dbRows.map(row => {
    const match = String(row.order_id).match(/^etsy-(\d+)-/);
    return match ? match[1] : String(row.order_id);
});

console.log(`✓ Found ${db_order_ids.length} orders in database\n`);

// Convert to Sets for comparison
const exportSet = new Set(etsy_export_ids.map(String));
const dbSet = new Set(db_order_ids.map(String));

// Find differences
const in_export_not_in_db = Array.from(exportSet).filter(id => !dbSet.has(id));
const in_db_not_in_export = Array.from(dbSet).filter(id => !exportSet.has(id));
const in_both = Array.from(exportSet).filter(id => dbSet.has(id));

console.log(`📈 COMPARISON RESULTS:`);
console.log(`─────────────────────`);
console.log(`In both (valid): ${in_both.length}`);
console.log(`In Etsy export, NOT in DB: ${in_export_not_in_db.length}`);
console.log(`In DB, NOT in Etsy export: ${in_db_not_in_export.length}\n`);

if (in_export_not_in_db.length > 0) {
    console.log(`⚠️  MISSING FROM DATABASE (${in_export_not_in_db.length} orders):`);
    console.log(`These are valid Etsy orders not yet synced:`);
    in_export_not_in_db.slice(0, 10).forEach(id => console.log(`  - ${id}`));
    if (in_export_not_in_db.length > 10) {
        console.log(`  ... and ${in_export_not_in_db.length - 10} more`);
    }
    console.log();
}

if (in_db_not_in_export.length > 0) {
    console.log(`❌ EXTRA IN DATABASE (${in_db_not_in_export.length} orders):`);
    console.log(`These orders are in DB but NOT in official Etsy export:`);
    console.log(`Likely: Refunded, Disputed, Invalid, or Outside date range\n`);
    
    // Get details on these extra orders
    const extraOrders = in_db_not_in_export.map(id => {
        const order = db.prepare('SELECT order_id, sale_price, order_date FROM Sales WHERE order_id LIKE ?').get(`etsy-${id}-%`);
        return {
            receipt_id: id,
            order_id: order?.order_id || 'N/A',
            price: order ? (order.sale_price / 100).toFixed(2) : 'N/A',
            date: order ? new Date(order.order_date).toISOString().split('T')[0] : 'N/A'
        };
    });
    
    extraOrders.forEach(order => {
        console.log(`  Receipt: ${order.receipt_id} | £${order.price} | ${order.date}`);
    });
    console.log();
}

// Summary
console.log(`📌 SUMMARY:`);
console.log(`─────────`);
const total_expected = etsy_export_ids.length;
const total_found = in_both.length;
const accuracy = ((total_found / total_expected) * 100).toFixed(1);

console.log(`Expected orders (Etsy export): ${total_expected}`);
console.log(`Found in database: ${total_found}`);
console.log(`Database coverage: ${accuracy}%`);

if (in_export_not_in_db.length > 0) {
    console.log(`\n⚠️  ACTION: Run sync again to fetch missing ${in_export_not_in_db.length} orders`);
}

if (in_db_not_in_export.length > 0) {
    console.log(`\n❌ ACTION: Verify or remove ${in_db_not_in_export.length} extra orders from database`);
}

db.close();
