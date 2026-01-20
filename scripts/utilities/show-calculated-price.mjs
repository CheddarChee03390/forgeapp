import db from './services/database.js';

const item = db.prepare(`
    SELECT 
        variation_sku, listing_id, current_price, calculated_price, 
        weight_grams, material_cost, status, profit, profit_margin_percent
    FROM Pricing_Staging 
    WHERE listing_id = 1796001027
`).get();

if (item) {
    console.log('Listing 1796001027 pricing:');
    console.log('  SKU:', item.variation_sku);
    console.log('  Current Price (Etsy):', 'GBP', item.current_price);
    console.log('  Calculated Price:', 'GBP', item.calculated_price);
    console.log('  Weight:', item.weight_grams, 'grams');
    console.log('  Material Cost:', 'GBP', item.material_cost);
    console.log('  Profit:', 'GBP', item.profit);
    console.log('  Margin %:', item.profit_margin_percent + '%');
    console.log('  Status:', item.status);
} else {
    console.log('Not found');
}
