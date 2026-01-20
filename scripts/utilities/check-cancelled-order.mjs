#!/usr/bin/env node
/**
 * Check if cancelled order 3664474997 is in the database
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Checking for cancelled order 3664474997 in database...\n');

const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

const order = db.prepare(`
    SELECT order_id, sale_price, order_date
    FROM Sales
    WHERE order_id LIKE '%3664474997%'
`).get();

if (order) {
    console.log('❌ CANCELLED ORDER FOUND IN DATABASE:');
    console.log({
        ...order,
        sale_price: `£${(order.sale_price / 100).toFixed(2)}`,
        order_date: new Date(order.order_date).toISOString().split('T')[0]
    });
    console.log('\n⚠️  The validation is NOT working - cancelled orders are still being synced!');
} else {
    console.log('✅ Cancelled order NOT found in database');
    console.log('✓ Validation is working correctly!');
}

// Also check total count
const totalEtsyOrders = db.prepare(`
    SELECT COUNT(*) as count
    FROM Sales
    WHERE order_id LIKE 'etsy-%'
`).get();

console.log(`\n📊 Total Etsy orders in database: ${totalEtsyOrders.count}`);
console.log('📊 Expected: 60 valid orders from export file');

db.close();
