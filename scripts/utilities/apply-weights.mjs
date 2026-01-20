import db from './services/database.js';

const updates = [
  { sku: 'BR_F2_GP_10', weight: 122.2 },
  { sku: 'BR_F2_GP_8', weight: 97.76 },
  { sku: 'BR_F2_GP_8.5', weight: 103.87 },
  { sku: 'BR_F2_GP_9', weight: 110 },
  { sku: 'BR_F2_GP_9.5', weight: 115 },
  { sku: 'CH_BELZ14_GP_20', weight: 116.6 },
  { sku: 'CH_BELZ14_GP_22', weight: 128.26 },
  { sku: 'CH_BELZ14_GP_24', weight: 140 },
  { sku: 'CH_BELZ14_GP_26', weight: 151.58 },
  { sku: 'CH_BELZ14_GP_28', weight: 163.24 },
  { sku: 'CH_BELZ14_GP_30', weight: 174.9 },
  { sku: 'CH_BELZ14_GP_32', weight: 186.56 },
  { sku: 'CH_F97ELB-CHAIN_20', weight: 91.6 },
  { sku: 'CH_F97ELB-CHAIN_22', weight: 100.76 },
  { sku: 'CH_F97ELB-CHAIN_24', weight: 110 },
  { sku: 'CH_F97ELB-CHAIN_26', weight: 119.08 },
  { sku: 'CH_F97ELB-CHAIN_28', weight: 128.24 },
  { sku: 'CH_F97ELB-CHAIN_30', weight: 137.4 },
  { sku: 'CH_F97ELB-CHAIN_32', weight: 146.56 },
  { sku: 'RIN_KEEPER4_925_GP', weight: 40 },
  { sku: 'RI_HORSE_SILVER_GP', weight: 30 },
  { sku: 'RI_PYR_925_GP', weight: 21 }
];

console.log(`Updating ${updates.length} SKUs with weight data from Etsy descriptions...\n`);

const updateStmt = db.prepare('UPDATE Master_Skus SET Weight = ? WHERE SKU = ?');

let updated = 0;
let failed = 0;
let notFound = 0;

updates.forEach(({ sku, weight }) => {
  try {
    // Check if SKU exists first
    const exists = db.prepare('SELECT SKU FROM Master_Skus WHERE SKU = ?').get(sku);
    if (!exists) {
      console.log(`✗ ${sku}: Not found in Master_Skus (needs to be created)`);
      notFound++;
      return;
    }
    
    const result = updateStmt.run(weight, sku);
    if (result.changes > 0) {
      console.log(`✓ ${sku}: Set weight to ${weight}g`);
      updated++;
    } else {
      console.log(`✗ ${sku}: Update failed (no rows affected)`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${sku}: Error - ${e.message}`);
    failed++;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY:`);
console.log(`  Updated: ${updated}`);
console.log(`  Failed: ${failed}`);
console.log(`  Not found in Master_Skus: ${notFound}`);
console.log(`${'='.repeat(60)}\n`);

if (notFound > 0) {
  console.log('SKUs that need to be created in Master_Skus:\n');
  updates.forEach(({ sku, weight }) => {
    const exists = db.prepare('SELECT SKU FROM Master_Skus WHERE SKU = ?').get(sku);
    if (!exists) {
      console.log(`INSERT INTO Master_Skus (SKU, Type, Weight) VALUES ('${sku}', 'Ring/Chain/Bracelet', ${weight});`);
    }
  });
}
