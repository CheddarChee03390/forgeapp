import db from './services/database.js';

const skus = [
  'BR_F2_GP_10',
  'BR_F2_GP_8',
  'BR_F2_GP_8.5',
  'BR_F2_GP_9',
  'BR_F2_GP_9.5',
  'CH_BELZ14_GP_20',
  'CH_BELZ14_GP_22',
  'CH_BELZ14_GP_24',
  'CH_BELZ14_GP_26',
  'CH_BELZ14_GP_28',
  'CH_BELZ14_GP_30',
  'CH_BELZ14_GP_32',
  'CH_F97ELB-CHAIN_20',
  'CH_F97ELB-CHAIN_22',
  'CH_F97ELB-CHAIN_24',
  'CH_F97ELB-CHAIN_26',
  'CH_F97ELB-CHAIN_28',
  'CH_F97ELB-CHAIN_30',
  'CH_F97ELB-CHAIN_32',
  'RIN_KEEPER4_925_GP',
  'RI_HORSE_SILVER_GP',
  'RI_PYR_925_GP'
];

console.log(`Updating ${skus.length} SKUs with material "Silver gold Plated"...\n`);

const updateStmt = db.prepare('UPDATE Master_Skus SET Material = ? WHERE SKU = ?');

let updated = 0;
let failed = 0;

skus.forEach(sku => {
  try {
    const result = updateStmt.run('Silver gold Plated', sku);
    if (result.changes > 0) {
      console.log(`✓ ${sku}: Set material to "Silver gold Plated"`);
      updated++;
    } else {
      console.log(`✗ ${sku}: Update failed`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${sku}: Error - ${e.message}`);
    failed++;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
console.log(`${'='.repeat(60)}\n`);

// Verify all materials are set
const check = db.prepare(`
  SELECT Material, COUNT(*) as count 
  FROM Master_Skus 
  WHERE SKU IN (${skus.map(() => '?').join(',')})
  GROUP BY Material
`).all(...skus);

console.log('Material breakdown after update:');
check.forEach(row => {
  console.log(`  ${row.Material}: ${row.count} SKUs`);
});
