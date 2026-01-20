import db from './services/database.js';

// Create mapping for the actual Etsy SKU
db.prepare(`
    INSERT OR REPLACE INTO Marketplace_Sku_Map (
        marketplace, variation_sku, internal_sku, is_active
    ) VALUES (?, ?, ?, ?)
`).run('etsy', 'ETSY_CH_CU26_SILVER', 'CH_CU26_28', 1);

console.log('Created mapping: ETSY_CH_CU26_SILVER -> CH_CU26_28');

// Now test the pricing query
const pricingQuery = `
    SELECT 
        COALESCE(i.sku, 'LISTING_' || i.listing_id) as variation_sku,
        i.listing_id,
        i.price as current_price,
        m2.SKU as internal_sku,
        m2.Weight as weight_grams,
        m2.Material as material,
        mat2.costPerGram,
        mat2.sellPricePerGram
    FROM Etsy_Inventory i
    LEFT JOIN Marketplace_Sku_Map map2
        ON map2.marketplace = 'etsy' 
        AND map2.variation_sku = COALESCE(i.sku, 'LISTING_' || i.listing_id)
        AND map2.is_active = 1
    LEFT JOIN Master_Skus m2
        ON m2.SKU = map2.internal_sku
    LEFT JOIN Materials mat2
        ON mat2.materialId = m2.Material
    WHERE i.listing_id = 1796001027
        AND i.has_variations = 0
`;

const result = db.prepare(pricingQuery).get();
console.log('\nPricing query result:');
console.log('  SKU:', result.variation_sku);
console.log('  Internal:', result.internal_sku);
console.log('  Weight:', result.weight_grams, 'grams');
console.log('  Material:', result.material);
console.log('  Cost per gram:', result.costPerGram);
console.log('  Sell per gram:', result.sellPricePerGram);
