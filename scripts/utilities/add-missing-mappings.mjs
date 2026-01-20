import db from './services/database.js';

const mappings = [
    { variation_sku: 'ETSY_RI_BULL', internal_sku: 'RI_BULL' },
    { variation_sku: 'ETSY_PEN_BOXINGLARGE', internal_sku: 'PEN_BOXINGLARGE' },
    { variation_sku: 'ETSY_PEN_HORSELARGE', internal_sku: 'PEN_HORSELARGE' }
];

console.log(`\n📍 Adding 3 missing SKU mappings:\n`);

const insertStmt = db.prepare(`
    INSERT INTO Marketplace_Sku_Map 
    (marketplace, variation_sku, internal_sku, is_active, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'))
`);

mappings.forEach(m => {
    try {
        insertStmt.run('etsy', m.variation_sku, m.internal_sku);
        console.log(`  ✅ ${m.variation_sku} → ${m.internal_sku}`);
    } catch (error) {
        console.log(`  ❌ ${m.variation_sku} → ${m.internal_sku}: ${error.message}`);
    }
});

console.log(`\n✅ Mappings added! Now run pricing calculation to include these items.\n`);
