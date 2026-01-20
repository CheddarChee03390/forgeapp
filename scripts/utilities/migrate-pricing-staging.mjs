import db from './services/database.js';

console.log('🔄 Migrating Pricing_Staging table...');

try {
    // Check if table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Pricing_Staging'").get();
    
    if (!tableExists) {
        console.log('✅ Pricing_Staging table does not exist yet (will be created on next startup)');
        process.exit(0);
    }

    // Backup old data
    console.log('  📋 Backing up current data...');
    const backupData = db.prepare('SELECT * FROM Pricing_Staging').all();
    console.log(`     Backed up ${backupData.length} rows`);

    // Drop old table
    console.log('  🗑️  Dropping old Pricing_Staging table...');
    db.exec('DROP TABLE Pricing_Staging');

    // Recreate with new schema
    console.log('  ✨ Creating new Pricing_Staging table with composite UNIQUE...');
    db.exec(`
        CREATE TABLE Pricing_Staging (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variation_sku TEXT NOT NULL,
            listing_id INTEGER,
            internal_sku TEXT,
            current_price REAL,
            base_calculated_price REAL,
            calculated_price REAL,
            margin_modifier REAL DEFAULT 0,
            weight_grams REAL,
            material TEXT,
            material_cost REAL,
            etsy_transaction_fee REAL,
            etsy_payment_fee REAL,
            etsy_listing_fee REAL DEFAULT 0.17,
            etsy_ad_fee REAL,
            postage_cost REAL,
            total_fees REAL,
            profit REAL,
            profit_margin_percent REAL,
            status TEXT DEFAULT 'pending',
            calculated_at INTEGER,
            approved_at INTEGER,
            pushed_at INTEGER,
            UNIQUE(listing_id, variation_sku)
        )
    `);

    // Restore data
    console.log('  ♻️  Restoring data...');
    if (backupData.length > 0) {
        const columns = Object.keys(backupData[0]);
        const placeholders = columns.map(() => '?').join(',');
        const insertStmt = db.prepare(`INSERT INTO Pricing_Staging (${columns.join(',')}) VALUES (${placeholders})`);
        
        let restored = 0;
        let skipped = 0;
        for (const row of backupData) {
            try {
                insertStmt.run(...columns.map(col => row[col]));
                restored++;
            } catch (e) {
                skipped++;
                console.log(`     ⚠️  Skipped duplicate: ${row.variation_sku} for listing ${row.listing_id}`);
            }
        }
        console.log(`     ✅ Restored ${restored} rows, skipped ${skipped} duplicates`);
    }

    console.log('✅ Migration complete!');
    process.exit(0);
} catch (e) {
    console.error('❌ Migration failed:', e.message);
    console.error(e.stack);
    process.exit(1);
}
