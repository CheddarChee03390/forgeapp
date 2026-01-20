import db from './services/database.js';

// Update the listing with the correct SKU from the raw data
const listing = db.prepare('SELECT listing_id, raw_api_data FROM Etsy_Inventory WHERE listing_id = 1796001027').get();

if (!listing) {
    console.log('Listing not found');
    process.exit(0);
}

const data = JSON.parse(listing.raw_api_data);
const sku = data.inventory?.products?.[0]?.sku || data.skus?.[0] || null;

if (sku) {
    db.prepare('UPDATE Etsy_Inventory SET sku = ? WHERE listing_id = ?').run(sku, listing.listing_id);
    console.log('Updated listing 1796001027 with SKU:', sku);
    
    // Now check the mapping
    const mapping = db.prepare('SELECT * FROM Marketplace_Sku_Map WHERE marketplace = ? AND variation_sku = ?').get('etsy', sku);
    if (mapping) {
        console.log('Found mapping:', mapping.internal_sku);
    } else {
        console.log('No mapping found for this SKU');
    }
} else {
    console.log('No SKU found in raw data');
}
