#!/usr/bin/env node
/**
 * Clean up database - Remove orders NOT in official Etsy export
 * This removes cancelled, refunded, and invalid orders
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧹 DATABASE CLEANUP');
console.log('='.repeat(50));

// Read the Etsy export file
const exportFilePath = path.join(__dirname, '../../Order Id check.txt');
const exportContent = fs.readFileSync(exportFilePath, 'utf-8');
const validIds = new Set(exportContent
    .split('\n')
    .map(id => id.trim())
    .filter(id => id && !id.startsWith('```')));

console.log(`✓ Loaded ${validIds.size} valid order IDs from Etsy export\n`);

// Open database
const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

// Get all Etsy orders
const allOrders = db.prepare('SELECT order_id, sale_price, order_date FROM Sales WHERE order_id LIKE ?').all('etsy-%');
console.log(`✓ Found ${allOrders.length} Etsy orders in database\n`);

// Identify orders to remove
const toRemove = [];
for (const order of allOrders) {
    const match = order.order_id.match(/^etsy-(\d+)-/);
    if (match) {
        const receiptId = match[1];
        if (!validIds.has(receiptId)) {
            toRemove.push({
                order_id: order.order_id,
                receipt_id: receiptId,
                price: (order.sale_price / 100).toFixed(2),
                date: new Date(order.order_date).toISOString().split('T')[0]
            });
        }
    }
}

if (toRemove.length === 0) {
    console.log('✅ No invalid orders to remove - database is clean!');
    db.close();
    process.exit(0);
}

console.log(`❌ Found ${toRemove.length} invalid orders to remove:\n`);
toRemove.forEach(order => {
    console.log(`  ${order.receipt_id} | £${order.price} | ${order.date}`);
});

console.log(`\n⚠️  About to delete ${toRemove.length} orders from database.`);
console.log('These are orders NOT in the official Etsy export.');
console.log('They are likely cancelled, refunded, or invalid.\n');

// Delete the orders
const deleteStmt = db.prepare('DELETE FROM Sales WHERE order_id = ?');
const deleteMany = db.transaction((orders) => {
    for (const order of orders) {
        deleteStmt.run(order.order_id);
    }
});

deleteMany(toRemove);

console.log(`✅ Deleted ${toRemove.length} invalid orders from database\n`);

// Verify
const remaining = db.prepare('SELECT COUNT(*) as count FROM Sales WHERE order_id LIKE ?').get('etsy-%');
console.log(`📊 RESULT:`);
console.log(`  Etsy orders remaining: ${remaining.count}`);
console.log(`  Expected (from export): ${validIds.size}`);

if (remaining.count === validIds.size) {
    console.log(`\n✅ SUCCESS: Database now matches Etsy export!`);
} else {
    console.log(`\n⚠️  WARNING: Count mismatch - may need to sync missing orders`);
}

db.close();
