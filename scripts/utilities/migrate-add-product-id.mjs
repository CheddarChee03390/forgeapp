import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'forge.db');
const db = new Database(dbPath);

console.log('Starting migration: Add product_id column to Etsy_Variations...\n');

try {
    db.exec('BEGIN TRANSACTION');

    // Check if product_id column already exists
    const tableInfo = db.prepare("PRAGMA table_info(Etsy_Variations)").all();
    const hasProductId = tableInfo.some(col => col.name === 'product_id');

    if (hasProductId) {
        console.log('✅ product_id column already exists, skipping migration');
        db.exec('ROLLBACK');
        process.exit(0);
    }

    // 1. Backup existing variations
    console.log('1. Backing up existing variations...');
    const backupVariations = db.prepare('SELECT * FROM Etsy_Variations').all();
    console.log(`   Found ${backupVariations.length} variations`);

    // 2. Drop old table
    console.log('2. Dropping old table...');
    db.exec('DROP TABLE Etsy_Variations');

    // 3. Create new table with product_id and new UNIQUE constraint
    console.log('3. Creating new table with product_id column...');
    db.exec(`
        CREATE TABLE Etsy_Variations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            product_id INTEGER,
            variation_sku TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            price REAL,
            property_values TEXT,
            internal_product_sku TEXT,
            last_synced INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            UNIQUE(listing_id, product_id),
            FOREIGN KEY (listing_id) REFERENCES Etsy_Inventory(listing_id) ON DELETE CASCADE
        )
    `);

    // 4. Restore variations (product_id will be NULL initially, will be populated on next sync)
    console.log('4. Restoring variations...');
    const insertStmt = db.prepare(`
        INSERT INTO Etsy_Variations (
            id, listing_id, product_id, variation_sku, quantity, price,
            property_values, internal_product_sku, last_synced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let restoredCount = 0;
    for (const variation of backupVariations) {
        try {
            insertStmt.run(
                variation.id,
                variation.listing_id,
                null, // product_id will be populated on next sync
                variation.variation_sku,
                variation.quantity,
                variation.price,
                variation.property_values,
                variation.internal_product_sku,
                variation.last_synced,
                variation.created_at,
                variation.updated_at
            );
            restoredCount++;
        } catch (error) {
            console.error(`   Error restoring variation ${variation.variation_sku}:`, error.message);
        }
    }
    console.log(`   Restored ${restoredCount} variations`);

    db.exec('COMMIT');

    // 5. Verify
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM Etsy_Variations').get();
    console.log(`\n✅ Migration complete!`);
    console.log(`✅ Added product_id column to Etsy_Variations`);
    console.log(`✅ Changed UNIQUE constraint to (listing_id, product_id)`);
    console.log(`✅ Verified: ${finalCount.count} variations in table`);
    console.log(`\n⚠️  Note: product_id values are NULL for now. Run a sync to populate them from Etsy API.`);

} catch (error) {
    console.error('❌ Migration failed:', error.message);
    db.exec('ROLLBACK');
    process.exit(1);
}

db.close();
