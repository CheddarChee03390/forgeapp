// Compare Etsy export receipt IDs with what's in our database
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

// Receipt IDs from Etsy export
const etsyExportIds = [
    '3936140523', '3926538368', '3917025997', '3915885659', '3915264847',
    '3905695748', '3901212864', '3907152181', '3897067374', '3874878961',
    '3874137625', '3869948962', '3866572914', '3868443233', '3867043649',
    '3861224436', '3861460553', '3860173993', '3857597599', '3844769374',
    '3841718848', '3832672902', '3831839318', '3832609699', '3832510061',
    '3831494527', '3829706442', '3825137951', '3815735496', '3802800904',
    '3791360706', '3791360595', '3700200897', '3701109660', '3707321693',
    '3703320884', '3768302476', '3754109782', '3746323189', '3744912670',
    '3724912679', '3721924027', '3720910661', '3698309518', '3693162146',
    '3692884986', '3700524333', '3697159251', '3687742876', '3692555469',
    '3676360341', '3672315317', '3666881149', '3653803276', '3658891791',
    '3652067906'
];

console.log('\n🔍 Comparing Etsy Export with Database\n');
console.log(`Etsy export has ${etsyExportIds.length} receipt IDs\n`);

// Get all receipt IDs from our database
const dbSales = db.prepare(`
    SELECT order_id, sale_price, product_name
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
`).all();

// Extract receipt IDs from our order_ids (format: etsy-{receipt_id}-{transaction_id})
const dbReceiptIds = new Set();
const dbReceiptMap = {}; // receipt_id -> array of sales

dbSales.forEach(sale => {
    const parts = sale.order_id.split('-');
    const receiptId = parts[1];
    dbReceiptIds.add(receiptId);
    
    if (!dbReceiptMap[receiptId]) {
        dbReceiptMap[receiptId] = [];
    }
    dbReceiptMap[receiptId].push(sale);
});

console.log(`Database has ${dbReceiptIds.size} unique receipt IDs\n`);

// Find receipts in Etsy export but NOT in database
const missingFromDb = etsyExportIds.filter(id => !dbReceiptIds.has(id));
console.log(`❌ In Etsy export but MISSING from database: ${missingFromDb.length}`);
if (missingFromDb.length > 0) {
    console.log('   Receipt IDs:');
    missingFromDb.forEach(id => console.log(`   - ${id}`));
}
console.log('');

// Find receipts in database but NOT in Etsy export
const extraInDb = Array.from(dbReceiptIds).filter(id => !etsyExportIds.includes(id));
console.log(`➕ In database but NOT in Etsy export: ${extraInDb.length}`);
if (extraInDb.length > 0) {
    console.log('   Receipt IDs:');
    extraInDb.slice(0, 20).forEach(id => {
        const sales = dbReceiptMap[id];
        const total = sales.reduce((sum, s) => sum + s.sale_price, 0);
        console.log(`   - ${id}: ${sales.length} items, £${total.toFixed(2)}`);
    });
    if (extraInDb.length > 20) {
        console.log(`   ... and ${extraInDb.length - 20} more`);
    }
}
console.log('');

// Calculate totals
const etsyExportTotal = etsyExportIds
    .filter(id => dbReceiptIds.has(id))
    .reduce((sum, id) => {
        const sales = dbReceiptMap[id];
        return sum + sales.reduce((s, sale) => s + sale.sale_price, 0);
    }, 0);

const extraTotal = extraInDb.reduce((sum, id) => {
    const sales = dbReceiptMap[id];
    return sum + sales.reduce((s, sale) => s + sale.sale_price, 0);
}, 0);

const dbTotal = dbSales.reduce((sum, s) => sum + s.sale_price, 0);

console.log('💰 Financial Summary:');
console.log(`   Matching receipts total: £${etsyExportTotal.toFixed(2)}`);
console.log(`   Extra receipts total: £${extraTotal.toFixed(2)}`);
console.log(`   Database total: £${dbTotal.toFixed(2)}`);
console.log(`   Difference: £${(dbTotal - etsyExportTotal).toFixed(2)}\n`);

// Show the extra receipts contributing to the high total
if (extraInDb.length > 0) {
    console.log('🔍 Details of EXTRA receipts in database:');
    const sorted = extraInDb
        .map(id => ({
            id,
            sales: dbReceiptMap[id],
            total: dbReceiptMap[id].reduce((s, sale) => s + sale.sale_price, 0)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    
    sorted.forEach(receipt => {
        console.log(`\n   Receipt ${receipt.id}: £${receipt.total.toFixed(2)}`);
        receipt.sales.forEach(s => {
            console.log(`      - ${s.product_name.substring(0, 60)}`);
            console.log(`        £${s.sale_price.toFixed(2)}`);
        });
    });
}
