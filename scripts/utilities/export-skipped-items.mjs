import db from './services/database.js';
import fs from 'fs';

console.log('\n📥 Exporting skipped pricing items...\n');

// Get all skipped items
const skipped = db.prepare(`
SELECT 
    v.variation_sku,
    v.listing_id,
    l.title,
    v.price,
    v.quantity,
    map.internal_sku,
    m.SKU as master_sku,
    m.Weight,
    mat.materialId,
    mat.sellPricePerGram
FROM Etsy_Variations v
LEFT JOIN Etsy_Inventory l ON v.listing_id = l.listing_id
LEFT JOIN Marketplace_Sku_Map map
    ON map.marketplace = 'etsy' 
    AND map.variation_sku = v.variation_sku
    AND map.is_active = 1
LEFT JOIN Master_Skus m ON m.SKU = map.internal_sku
LEFT JOIN Materials mat ON mat.materialId = m.Material
WHERE NOT (v.variation_sku IS NOT NULL 
    AND map.internal_sku IS NOT NULL 
    AND m.Weight IS NOT NULL 
    AND mat.sellPricePerGram IS NOT NULL)
ORDER BY l.title, v.variation_sku
`).all();

console.log(`Found ${skipped.length} skipped items\n`);

// Create CSV content
const headers = ['Listing ID', 'Title', 'Variation SKU', 'Price', 'Quantity', 'Mapped Internal SKU', 'Master SKU', 'Weight (g)', 'Material', 'Sell Price/g'];
const rows = skipped.map(item => [
    item.listing_id,
    `"${(item.title || '').replace(/"/g, '""')}"`,
    item.variation_sku || '',
    item.price || 0,
    item.quantity || 0,
    item.internal_sku || 'NOT MAPPED',
    item.master_sku || '',
    item.Weight || 'MISSING',
    item.materialId || '',
    item.sellPricePerGram || 'MISSING'
]);

const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

// Save to file
const filename = `skipped_pricing_items_${new Date().toISOString().split('T')[0]}.csv`;
fs.writeFileSync(filename, csvContent);

console.log(`✅ Exported to: ${filename}\n`);

// Summary by issue
console.log('📊 Summary by issue:\n');

const issues = {
    notMapped: skipped.filter(s => !s.internal_sku).length,
    noWeight: skipped.filter(s => s.internal_sku && !s.Weight).length,
    noSellPrice: skipped.filter(s => s.Weight && !s.sellPricePerGram).length
};

console.log(`  ❌ Not mapped to Master SKU: ${issues.notMapped} items`);
console.log(`  ⚠️  Mapped but missing weight: ${issues.noWeight} items`);
console.log(`  ⚠️  Have weight but missing sell price: ${issues.noSellPrice} items\n`);

// Show sample of each category
if (issues.notMapped > 0) {
    console.log('Sample NOT MAPPED items:');
    skipped.filter(s => !s.internal_sku).slice(0, 3).forEach(item => {
        console.log(`  • ${item.variation_sku} (Listing ${item.listing_id})`);
    });
    console.log();
}

if (issues.noWeight > 0) {
    console.log('Sample MISSING WEIGHT items:');
    skipped.filter(s => s.internal_sku && !s.Weight).slice(0, 3).forEach(item => {
        console.log(`  • ${item.variation_sku} → ${item.internal_sku} (Listing ${item.listing_id})`);
    });
    console.log();
}

if (issues.noSellPrice > 0) {
    console.log('Sample MISSING SELL PRICE items:');
    skipped.filter(s => s.Weight && !s.sellPricePerGram).slice(0, 3).forEach(item => {
        console.log(`  • ${item.variation_sku} → ${item.internal_sku} | ${item.materialId} (Listing ${item.listing_id})`);
    });
}
