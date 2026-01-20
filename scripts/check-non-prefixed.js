import Database from 'better-sqlite3';
const db = new Database('../data/forge.db');
const rows = db.prepare("SELECT listing_id, variation_sku FROM Etsy_Variations WHERE variation_sku NOT LIKE 'ETSY_%' LIMIT 10").all();
console.log(rows);
db.close();
