import db from './services/database.js';

const failed = db.prepare(`SELECT variation_sku, status, current_price, calculated_price FROM Pricing_Staging WHERE status = 'failed'`).all();

console.log('\nFailed items:', failed.length);
failed.forEach(f => {
    const change = ((f.calculated_price - f.current_price) / f.current_price * 100).toFixed(1);
    console.log(`${f.variation_sku}`);
    console.log(`  Current: £${f.current_price?.toFixed(2)} → Calculated: £${f.calculated_price?.toFixed(2)} (${change}%)`);
});
