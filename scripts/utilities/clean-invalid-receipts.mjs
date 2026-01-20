// Remove receipts that aren't in the Etsy export
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

// Valid receipt IDs from Etsy export
const validReceiptIds = [
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

console.log('\n🧹 Cleaning up invalid receipts...\n');

// Find all sales with receipts NOT in the valid list
const allSales = db.prepare(`
    SELECT id, order_id, sale_price, product_name
    FROM Sales 
    WHERE order_id LIKE 'etsy-%'
`).all();

const toDelete = [];
let validCount = 0;
let deleteValue = 0;

allSales.forEach(sale => {
    const receiptId = sale.order_id.split('-')[1];
    if (!validReceiptIds.includes(receiptId)) {
        toDelete.push(sale.id);
        deleteValue += sale.sale_price;
    } else {
        validCount++;
    }
});

console.log(`Found ${allSales.length} total Etsy sales`);
console.log(`Valid (in export): ${validCount} sales`);
console.log(`Invalid (not in export): ${toDelete.length} sales worth £${deleteValue.toFixed(2)}\n`);

if (toDelete.length > 0) {
    console.log('Deleting invalid sales...');
    
    db.exec('BEGIN TRANSACTION');
    
    try {
        // Delete related fees first
        const deleteFees = db.prepare(`
            DELETE FROM Etsy_Fees 
            WHERE order_id IN (
                SELECT order_id FROM Sales WHERE id = ?
            )
        `);
        
        const deleteSale = db.prepare('DELETE FROM Sales WHERE id = ?');
        
        toDelete.forEach(id => {
            deleteFees.run(id);
            deleteSale.run(id);
        });
        
        db.exec('COMMIT');
        console.log(`✅ Deleted ${toDelete.length} invalid sales\n`);
        
        // Show new totals
        const remaining = db.prepare(`
            SELECT COUNT(*) as count, SUM(sale_price * quantity) as total
            FROM Sales WHERE order_id LIKE 'etsy-%'
        `).get();
        
        console.log('📊 After cleanup:');
        console.log(`   Remaining sales: ${remaining.count}`);
        console.log(`   Total value: £${remaining.total.toFixed(2)}`);
        console.log(`   Removed: £${deleteValue.toFixed(2)}\n`);
        
    } catch (error) {
        db.exec('ROLLBACK');
        console.error('❌ Error:', error);
    }
} else {
    console.log('✅ All sales are valid - nothing to delete\n');
}
