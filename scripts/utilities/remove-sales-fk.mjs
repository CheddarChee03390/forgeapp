// Remove FOREIGN KEY constraint from Sales.listing_id
// This allows sales to be logged even if the listing doesn't exist in Etsy_Inventory
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/forge.db');
const db = new Database(DB_PATH);

console.log('🔄 Removing FOREIGN KEY constraint from Sales.listing_id...\n');

try {
    // 1. Start transaction
    db.exec('BEGIN TRANSACTION');

    // 2. Backup existing sales data
    console.log('1. Backing up sales data...');
    const backupSales = db.prepare('SELECT * FROM Sales').all();
    console.log(`   Found ${backupSales.length} sales records`);

    // 3. Drop old table
    console.log('2. Dropping old Sales table...');
    db.exec('DROP TABLE Sales');

    // 4. Recreate table WITHOUT FK constraint
    console.log('3. Creating new Sales table without FK constraint...');
    db.exec(`
        CREATE TABLE Sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            listing_id INTEGER,
            sku TEXT,
            product_name TEXT,
            quantity INTEGER DEFAULT 1,
            sale_price REAL NOT NULL,
            material_cost_at_sale REAL,
            tax_included REAL DEFAULT 0,
            order_date DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            synced_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 5. Restore data
    console.log('4. Restoring sales data...');
    if (backupSales.length > 0) {
        const insert = db.prepare(`
            INSERT INTO Sales 
            (id, order_id, listing_id, sku, product_name, quantity, sale_price, 
             material_cost_at_sale, tax_included, order_date, status, synced_date, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const sale of backupSales) {
            insert.run(
                sale.id,
                sale.order_id,
                sale.listing_id,
                sale.sku,
                sale.product_name,
                sale.quantity,
                sale.sale_price,
                sale.material_cost_at_sale,
                sale.tax_included,
                sale.order_date,
                sale.status,
                sale.synced_date,
                sale.notes,
                sale.created_at
            );
        }
        console.log(`   Restored ${backupSales.length} sales records`);
    }

    // 6. Recreate indexes
    console.log('5. Recreating indexes...');
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_order_id ON Sales(order_id);
        CREATE INDEX IF NOT EXISTS idx_sales_sku ON Sales(sku);
        CREATE INDEX IF NOT EXISTS idx_sales_order_date ON Sales(order_date);
    `);

    // 7. Commit
    db.exec('COMMIT');

    console.log('\n✅ Migration complete!');
    console.log('   - Sales.listing_id is now a regular column (no FK constraint)');
    console.log('   - Sales can be logged even if listing is not in Etsy_Inventory');
    console.log('   - All existing data preserved\n');

} catch (error) {
    db.exec('ROLLBACK');
    console.error('❌ Migration error:', error);
    process.exit(1);
}
