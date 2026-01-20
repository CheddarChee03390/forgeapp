import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'forge.db');

const db = new Database(dbPath);

console.log('🔍 Checking Marketplace_Sku_Map table...');

// Count records that need updating
const countResult = db.prepare(`
    SELECT COUNT(*) as c 
    FROM Marketplace_Sku_Map 
    WHERE marketplace = 'etsy' 
    AND variation_sku NOT LIKE 'ETSY_%'
`).get();

console.log(`📊 Found ${countResult.c} records needing ETSY_ prefix`);

if (countResult.c > 0) {
    // Show sample before
    console.log('\n📋 Sample BEFORE update:');
    const sampleBefore = db.prepare('SELECT * FROM Marketplace_Sku_Map LIMIT 3').all();
    sampleBefore.forEach(row => {
        console.log(`  ${row.variation_sku} -> ${row.internal_sku}`);
    });

    // Update the records
    const result = db.prepare(`
        UPDATE Marketplace_Sku_Map 
        SET variation_sku = 'ETSY_' || variation_sku 
        WHERE marketplace = 'etsy' 
        AND variation_sku NOT LIKE 'ETSY_%'
    `).run();

    console.log(`\n✅ Updated ${result.changes} mapping records with ETSY_ prefix`);

    // Show sample after
    console.log('\n📋 Sample AFTER update:');
    const sampleAfter = db.prepare('SELECT * FROM Marketplace_Sku_Map LIMIT 3').all();
    sampleAfter.forEach(row => {
        console.log(`  ${row.variation_sku} -> ${row.internal_sku}`);
    });
} else {
    console.log('✅ All records already have ETSY_ prefix');
}

db.close();
console.log('\n✅ Done!');
