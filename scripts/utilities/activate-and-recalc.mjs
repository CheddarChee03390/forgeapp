import db from './services/database.js';

const skus = ['ETSY_PE_CROSS_SILVER', 'ETSY_PEN_TN95', 'ETSY_RI_KNOT_SMALL_SILVER'];

console.log('Activating inactive mappings:\n');

for (const sku of skus) {
    const result = db.prepare('UPDATE Marketplace_Sku_Map SET is_active = 1 WHERE variation_sku = ?').run(sku);
    if (result.changes > 0) {
        console.log(`  ✅ ${sku} -> ACTIVATED`);
    } else {
        console.log(`  ❌ ${sku} -> NOT FOUND`);
    }
}

console.log('\nRecalculating pricing...');
const {default: pricingService} = await import('./services/pricingService.js');
const calcResult = pricingService.calculateAllPrices();
console.log(`Result: ${calcResult.calculated} calculated, ${calcResult.skipped} skipped`);
