import db from './services/database.js';

// Find all LISTING_ items (unmapped parent listings without SKU)
const unmapped = db.prepare(`
    SELECT DISTINCT listing_id FROM Pricing_Staging 
    WHERE variation_sku LIKE 'LISTING_%'
`).all();

console.log(`Found ${unmapped.length} unmapped listings with LISTING_ SKU\n`);

let fixed = 0;
let noData = 0;

for (const item of unmapped) {
    const listingId = item.listing_id;
    
    // Get raw Etsy data
    const row = db.prepare('SELECT sku, raw_api_data FROM Etsy_Inventory WHERE listing_id = ?').get(listingId);
    
    if (!row || !row.raw_api_data) {
        console.log(`  ❌ ${listingId}: No raw data found`);
        noData++;
        continue;
    }
    
    const apiData = JSON.parse(row.raw_api_data);
    const sku = apiData.inventory?.products?.[0]?.sku || apiData.skus?.[0] || null;
    
    if (!sku) {
        console.log(`  ❌ ${listingId}: No SKU in Etsy API data`);
        continue;
    }
    
    // Update the listing with the SKU
    db.prepare('UPDATE Etsy_Inventory SET sku = ? WHERE listing_id = ?').run(sku, listingId);
    console.log(`  ✅ ${listingId}: Extracted SKU: ${sku}`);
    
    // Check if mapping exists
    const mapping = db.prepare('SELECT * FROM Marketplace_Sku_Map WHERE marketplace = ? AND variation_sku = ?').get('etsy', sku);
    if (mapping) {
        console.log(`     └─ Mapping found: ${sku} -> ${mapping.internal_sku}`);
    } else {
        console.log(`     └─ NO mapping (will need manual creation)`);
    }
    
    fixed++;
}

console.log(`\nSummary:`);
console.log(`  Fixed: ${fixed}`);
console.log(`  No data: ${noData}`);
console.log(`  Total: ${unmapped.length}`);
