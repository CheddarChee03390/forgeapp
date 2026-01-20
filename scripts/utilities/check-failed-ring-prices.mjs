import db from './services/database.js';

console.log('\n=== Failed Ring Price Updates ===\n');

// Get failed rings from Pricing_Staging
const failedRings = db.prepare(`
    SELECT 
        ps.variation_sku,
        ps.status,
        ps.push_error,
        ps.current_price,
        ps.calculated_price,
        ps.price_change_percent,
        ev.listing_id,
        ms.type
    FROM Pricing_Staging ps
    LEFT JOIN Etsy_Variations ev ON ps.variation_sku = ev.variation_sku
    LEFT JOIN Marketplace_Sku_Map msm ON ev.variation_sku = msm.variation_sku
    LEFT JOIN Master_Skus ms ON msm.master_sku = ms.sku
    WHERE ps.status = 'failed' AND (ms.type = 'Ring' OR ev.variation_sku LIKE '%RI_%')
    ORDER BY ps.current_price DESC
`).all();

console.log(`Found ${failedRings.length} failed ring items:\n`);

failedRings.forEach((item, i) => {
    const priceChange = ((item.calculated_price - item.current_price) / item.current_price * 100).toFixed(1);
    console.log(`${i + 1}. ${item.variation_sku}`);
    console.log(`   Current Price: £${item.current_price?.toFixed(2) || 'N/A'}`);
    console.log(`   Calculated Price: £${item.calculated_price?.toFixed(2) || 'N/A'}`);
    console.log(`   Change: ${priceChange}%`);
    console.log(`   Error: ${item.push_error || 'Unknown'}`);
    console.log(`   Listing ID: ${item.listing_id}`);
    console.log();
});

// Check for price consistency issues
console.log('\n=== Price Consistency Analysis ===\n');

const listingsByVariation = db.prepare(`
    SELECT 
        ev.listing_id,
        COUNT(DISTINCT ps.variation_sku) as variation_count,
        COUNT(DISTINCT ps.current_price) as unique_current_prices,
        COUNT(DISTINCT ps.calculated_price) as unique_calculated_prices,
        GROUP_CONCAT(DISTINCT ps.current_price) as current_prices,
        GROUP_CONCAT(DISTINCT ps.calculated_price) as calculated_prices
    FROM Pricing_Staging ps
    LEFT JOIN Etsy_Variations ev ON ps.variation_sku = ev.variation_sku
    LEFT JOIN Marketplace_Sku_Map msm ON ev.variation_sku = msm.variation_sku
    LEFT JOIN Master_Skus ms ON msm.master_sku = ms.sku
    WHERE ps.status = 'failed' AND (ms.type = 'Ring' OR ev.variation_sku LIKE '%RI_%')
    GROUP BY ev.listing_id
`).all();

listingsByVariation.forEach((listing) => {
    if (listing.listing_id) {
        console.log(`Listing ${listing.listing_id}:`);
        console.log(`  Variations: ${listing.variation_count}`);
        console.log(`  Unique Current Prices: ${listing.unique_current_prices}`);
        console.log(`  Unique Calculated Prices: ${listing.unique_calculated_prices}`);
        console.log(`  Current Prices: ${listing.current_prices}`);
        console.log(`  Calculated Prices: ${listing.calculated_prices}`);
        console.log();
    }
});
