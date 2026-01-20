import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

const orders = [
    { id: 'etsy-3664474997-4567363479', price: 408, date: '2025-04-22' },
    { id: 'etsy-3680265954-4598050757', price: 210, date: '2025-05-16' },
    { id: 'etsy-3705868828-4614794700', price: 150, date: '2025-06-11' },
    { id: 'etsy-3711617960-4622168326', price: 729, date: '2025-06-18' },
    { id: 'etsy-3752899464-4674837906', price: 160, date: '2025-08-01' },
    { id: 'etsy-3765561094-4691171246', price: 210, date: '2025-08-13' },
    { id: 'etsy-3840338951-4785847272', price: 230, date: '2025-10-26' },
    { id: 'etsy-3842837852-4798191063', price: 186, date: '2025-10-30' },
    { id: 'etsy-3856489549-4814438719', price: 690, date: '2025-11-10' }
];

const stmt = db.prepare('INSERT INTO Sales (order_id, sale_price, order_date) VALUES (?, ?, ?)');
for (const order of orders) {
    stmt.run(order.id, order.price, new Date(order.date).getTime());
}
db.close();
console.log('Restored 9 orders');
