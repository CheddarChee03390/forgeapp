import db from './services/database.js';

const skus = [
  { sku: 'BR_F2_GP_10', type: 'Bracelet', weight: 122.2 },
  { sku: 'BR_F2_GP_8', type: 'Bracelet', weight: 97.76 },
  { sku: 'BR_F2_GP_8.5', type: 'Bracelet', weight: 103.87 },
  { sku: 'BR_F2_GP_9', type: 'Bracelet', weight: 110 },
  { sku: 'BR_F2_GP_9.5', type: 'Bracelet', weight: 115 },
  { sku: 'CH_BELZ14_GP_20', type: 'Chain', weight: 116.6 },
  { sku: 'CH_BELZ14_GP_22', type: 'Chain', weight: 128.26 },
  { sku: 'CH_BELZ14_GP_24', type: 'Chain', weight: 140 },
  { sku: 'CH_BELZ14_GP_26', type: 'Chain', weight: 151.58 },
  { sku: 'CH_BELZ14_GP_28', type: 'Chain', weight: 163.24 },
  { sku: 'CH_BELZ14_GP_30', type: 'Chain', weight: 174.9 },
  { sku: 'CH_BELZ14_GP_32', type: 'Chain', weight: 186.56 },
  { sku: 'CH_F97ELB-CHAIN_20', type: 'Chain', weight: 91.6 },
  { sku: 'CH_F97ELB-CHAIN_22', type: 'Chain', weight: 100.76 },
  { sku: 'CH_F97ELB-CHAIN_24', type: 'Chain', weight: 110 },
  { sku: 'CH_F97ELB-CHAIN_26', type: 'Chain', weight: 119.08 },
  { sku: 'CH_F97ELB-CHAIN_28', type: 'Chain', weight: 128.24 },
  { sku: 'CH_F97ELB-CHAIN_30', type: 'Chain', weight: 137.4 },
  { sku: 'CH_F97ELB-CHAIN_32', type: 'Chain', weight: 146.56 },
  { sku: 'RIN_KEEPER4_925_GP', type: 'Ring', weight: 40 },
  { sku: 'RI_HORSE_SILVER_GP', type: 'Ring', weight: 30 },
  { sku: 'RI_PYR_925_GP', type: 'Ring', weight: 21 }
];

console.log(`Creating ${skus.length} new Master_Skus entries with weight data from Etsy descriptions...\n`);

const insertStmt = db.prepare('INSERT INTO Master_Skus (SKU, Type, Weight) VALUES (?, ?, ?)');

let inserted = 0;
let failed = 0;
let exists = 0;

skus.forEach(({ sku, type, weight }) => {
  try {
    // Check if already exists
    const existing = db.prepare('SELECT SKU FROM Master_Skus WHERE SKU = ?').get(sku);
    if (existing) {
      console.log(`→ ${sku}: Already exists`);
      exists++;
      return;
    }
    
    const result = insertStmt.run(sku, type, weight);
    if (result.changes > 0) {
      console.log(`✓ ${sku}: Created with weight ${weight}g`);
      inserted++;
    } else {
      console.log(`✗ ${sku}: Insertion failed`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${sku}: Error - ${e.message}`);
    failed++;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY:`);
console.log(`  Created: ${inserted}`);
console.log(`  Already existed: ${exists}`);
console.log(`  Failed: ${failed}`);
console.log(`${'='.repeat(60)}\n`);

// Verify the data was inserted
const count = db.prepare('SELECT COUNT(*) as total FROM Master_Skus WHERE Weight IS NOT NULL').get();
console.log(`Total Master_Skus with weights: ${count.total}`);
