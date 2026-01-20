// Migration script to fix Etsy_Variations UNIQUE constraint
// Changes from UNIQUE(variation_sku) to UNIQUE(listing_id, variation_sku)
// This allows the same SKU to exist across different listings

import db from './services/database.js';

console.log('Starting migration: Fix Etsy_Variations UNIQUE constraint...');

try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    // 1. Create backup of existing data
    console.log('1. Backing up existing variations...');
    const existingVariations = db.prepare('SELECT * FROM Etsy_Variations').all();
    console.log(`   Found ${existingVariations.length} variations`);
    
    // 2. Drop the old table
    console.log('2. Dropping old table...');
    db.exec('DROP TABLE IF EXISTS Etsy_Variations');
    
    // 3. Create new table with composite UNIQUE constraint
    console.log('3. Creating new table with composite UNIQUE(listing_id, variation_sku)...');
    db.exec(`
        CREATE TABLE Etsy_Variations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            variation_sku TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            price REAL,
            property_values TEXT,
            internal_product_sku TEXT,
            last_synced INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            UNIQUE(listing_id, variation_sku),
            FOREIGN KEY (listing_id) REFERENCES Etsy_Inventory(listing_id) ON DELETE CASCADE
        )
    `);
    
    // 4. Restore data
    console.log('4. Restoring variations...');
    if (existingVariations.length > 0) {
        const stmt = db.prepare(`
            INSERT INTO Etsy_Variations (
                id, listing_id, variation_sku, quantity, price,
                property_values, internal_product_sku, last_synced, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const v of existingVariations) {
            stmt.run(
                v.id, v.listing_id, v.variation_sku, v.quantity, v.price,
                v.property_values, v.internal_product_sku, v.last_synced,
                v.created_at, v.updated_at
            );
        }
        console.log(`   Restored ${existingVariations.length} variations`);
    }
    
    // 5. Commit transaction
    db.exec('COMMIT');
    
    console.log('✅ Migration complete!');
    console.log('✅ Etsy_Variations now allows same SKU across different listings');
    
    // Verify
    const count = db.prepare('SELECT COUNT(*) as count FROM Etsy_Variations').get();
    console.log(`✅ Verified: ${count.count} variations in table`);
    
} catch (error) {
    console.error('❌ Migration failed:', error.message);
    db.exec('ROLLBACK');
    process.exit(1);
}
