import db from './services/database.js';

console.log(`\n✅ Verifying the 3 mappings work:\n`);

const query = `
SELECT 
    COALESCE(i.sku, 'LISTING_' || i.listing_id) as variation_sku,
    i.listing_id,
    i.title,
    map.internal_sku,
    m.Weight,
    m.Material
FROM Etsy_Inventory i
LEFT JOIN Marketplace_Sku_Map map 
    ON map.marketplace = 'etsy' 
    AND map.variation_sku = COALESCE(i.sku, 'LISTING_' || i.listing_id)
    AND map.is_active = 1
LEFT JOIN Master_Skus m 
    ON m.SKU = map.internal_sku
WHERE i.listing_id IN (1778623276, 1792810239, 1814882787)
`;

const results = db.prepare(query).all();
results.forEach(r => {
    const status = r.internal_sku && r.Weight ? '✅' : '❌';
    console.log(`${status} Listing ${r.listing_id}: ${r.title.substring(0, 40)}`);
    console.log(`   SKU: ${r.variation_sku} → ${r.internal_sku || 'NOT MAPPED'}`);
    console.log(`   Weight: ${r.Weight || 'MISSING'}g, Material: ${r.Material || 'MISSING'}\n`);
});
