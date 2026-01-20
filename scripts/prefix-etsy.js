import Database from 'better-sqlite3';

const db = new Database('../data/forge.db');
const now = Math.floor(Date.now() / 1000);
const pref = (s) => (s && s.startsWith('ETSY_') ? s : s ? `ETSY_${s}` : s);

let prefixedVariations = 0;
const varRows = db.prepare('SELECT id, variation_sku FROM Etsy_Variations').all();
const upVar = db.prepare('UPDATE Etsy_Variations SET variation_sku=? WHERE id=?');
for (const r of varRows) {
  const p = pref(r.variation_sku);
  if (p && p !== r.variation_sku) {
    upVar.run(p, r.id);
    prefixedVariations++;
  }
}

let prefixedMappings = 0;
const mapRows = db
  .prepare("SELECT id, variation_sku FROM Marketplace_Sku_Map WHERE marketplace='etsy'")
  .all();
const upMap = db.prepare('UPDATE Marketplace_Sku_Map SET variation_sku=?, updated_at=? WHERE id=?');
for (const r of mapRows) {
  const p = pref(r.variation_sku);
  if (p && p !== r.variation_sku) {
    upMap.run(p, now, r.id);
    prefixedMappings++;
  }
}

console.log({ prefixedVariations, prefixedMappings });
db.close();
