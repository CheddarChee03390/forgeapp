/**
 * Remove Suspicious Orders
 * Cleans up the 9 orders that appear in DB but not in official Etsy export
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const suspiciousReceiptIds = [
    3664474997,
    3680265954,
    3705868828,
    3711617960,
    3752899464,
    3765561094,
    3840338951,
    3842837852,
    3856489549
];

const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

console.log(`🧹 CLEANING SUSPICIOUS ORDERS`);
console.log(`════════════════════════════════\n`);

let totalDeleted = 0;
let totalValue = 0;

for (const receiptId of suspiciousReceiptIds) {
    const orders = db.prepare('SELECT order_id, sale_price FROM Sales WHERE order_id LIKE ?').all(`etsy-${receiptId}-%`);
    
    if (orders.length > 0) {
        for (const order of orders) {
            const deleted = db.prepare('DELETE FROM Sales WHERE order_id = ?').run(order.order_id);
            if (deleted.changes > 0) {
                totalDeleted++;
                totalValue += order.sale_price;
                console.log(`✓ Deleted: ${order.order_id} (£${(order.sale_price / 100).toFixed(2)})`);
            }
        }
    }
}

console.log(`\n📊 CLEANUP SUMMARY`);
console.log(`══════════════════`);
console.log(`Orders deleted: ${totalDeleted}`);
console.log(`Value removed: £${(totalValue / 100).toFixed(2)}`);

const remaining = db.prepare('SELECT COUNT(*) as count FROM Sales').get();
console.log(`Remaining orders in DB: ${remaining.count}`);

db.close();
console.log(`\n✅ Cleanup complete`);
