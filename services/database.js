// SQLite Database Service
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, 'forge.db');
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
    // Create Materials table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Materials (
            materialId TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            costPerGram REAL NOT NULL DEFAULT 0,
            sellPricePerGram REAL DEFAULT 0
        )
    `);

    // Create Master_Skus table (matching CSV structure)
    db.exec(`
        CREATE TABLE IF NOT EXISTS Master_Skus (
            SKU TEXT PRIMARY KEY,
            Type TEXT,
            Length REAL,
            Weight REAL NOT NULL,
            Material TEXT,
            postagecost REAL DEFAULT 0,
            FOREIGN KEY (Material) REFERENCES Materials(materialId)
        )
    `);

    // Create Etsy_Inventory table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Etsy_Inventory (
            listing_id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            sku TEXT,
            quantity INTEGER DEFAULT 0,
            price REAL,
            state TEXT,
            created_timestamp INTEGER,
            updated_timestamp INTEGER,
            url TEXT,
            num_favorers INTEGER DEFAULT 0,
            views INTEGER DEFAULT 0,
            tags TEXT,
            materials TEXT,
            shop_section_id INTEGER,
            has_variations BOOLEAN DEFAULT 0,
            raw_api_data TEXT,
            last_synced INTEGER
        )
    `);

    // Create OAuth_Tokens table for secure token storage
    db.exec(`
        CREATE TABLE IF NOT EXISTS OAuth_Tokens (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            access_token TEXT,
            refresh_token TEXT,
            expires_at INTEGER,
            shop_id TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);

    // Create PKCE Challenges table for OAuth
    db.exec(`
        CREATE TABLE IF NOT EXISTS PKCE_Challenges (
            state TEXT PRIMARY KEY,
            code_verifier TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);

    // Create Etsy_Variations table for tracking SKU variations per listing
    db.exec(`
        CREATE TABLE IF NOT EXISTS Etsy_Variations (
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
            UNIQUE(listing_id, variation_sku),
            FOREIGN KEY (listing_id) REFERENCES Etsy_Inventory(listing_id) ON DELETE CASCADE
        )
    `);

    // Map marketplace variation SKUs to internal SKUs
    db.exec(`
        CREATE TABLE IF NOT EXISTS Marketplace_Sku_Map (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            marketplace TEXT NOT NULL,
            variation_sku TEXT NOT NULL,
            internal_sku TEXT,
            is_active INTEGER DEFAULT 1,
            updated_at INTEGER,
            UNIQUE(marketplace, variation_sku)
        )
    `);

    // Create Material_Costs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Material_Costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id TEXT NOT NULL,
            cost REAL NOT NULL,
            effective_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_current BOOLEAN DEFAULT 0,
            changed_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (material_id) REFERENCES Materials(materialId),
            UNIQUE(material_id, effective_date)
        )
    `);

    // Create Sales table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            etsy_order_number TEXT,
            listing_id INTEGER,
            sku TEXT,
            product_name TEXT,
            quantity INTEGER DEFAULT 1,
            sale_price REAL NOT NULL,
            material_cost_at_sale REAL,
            tax_amount REAL DEFAULT 0,
            tax_included REAL DEFAULT 0,
            order_date DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            synced_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES Etsy_Inventory(listing_id)
        )
    `);

    // Create Etsy_Fees table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Etsy_Fees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT,
            fee_type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            charged_date DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            fee_hash TEXT UNIQUE,
            is_credit BOOLEAN DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES Sales(order_id)
        )
    `);

    // Track locked months for imports
    db.exec(`
        CREATE TABLE IF NOT EXISTS Import_Locks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            month TEXT NOT NULL,
            locked_by TEXT,
            locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            note TEXT,
            UNIQUE(source, month)
        )
    `);

    // Create Supplier_Costs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Supplier_Costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL,
            supplier_id TEXT,
            unit_cost REAL NOT NULL,
            effective_from DATE NOT NULL,
            effective_to DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            UNIQUE(sku, effective_from)
        )
    `);

    console.log('✅ Database schema initialized');

    // Migration: Add missing columns if they don't exist
    try {
        const columns = db.pragma('table_info(Etsy_Inventory)');
        const columnNames = columns.map(col => col.name);
        
        if (!columnNames.includes('has_variations')) {
            db.exec('ALTER TABLE Etsy_Inventory ADD COLUMN has_variations BOOLEAN DEFAULT 0');
            console.log('✅ Added has_variations column');
        }
        
        if (!columnNames.includes('raw_api_data')) {
            db.exec('ALTER TABLE Etsy_Inventory ADD COLUMN raw_api_data TEXT');
            console.log('✅ Added raw_api_data column');
        }

        // No additional migration needed here
    } catch (error) {
        console.log('✓ Etsy_Inventory columns already exist');
    }

    // Create Pricing_Staging table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Pricing_Staging (
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

    // Insert default materials if empty
    const materialCount = db.prepare('SELECT COUNT(*) as count FROM Materials').get();
    if (materialCount.count === 0) {
        const insertMaterial = db.prepare(
            'INSERT INTO Materials (materialId, name, costPerGram) VALUES (?, ?, ?)'
        );

        const defaultMaterials = [
            ['Silver', 'Silver', 0.85],
            ['Gold', 'Gold', 5.20],
            ['Bronze', 'Bronze', 0.12]
        ];

        for (const [id, name, cost] of defaultMaterials) {
            insertMaterial.run(id, name, cost);
        }

        console.log('✅ Default materials created');
    }
    
    // Run migrations for schema updates
    runMigrations();
}

/**
 * Apply schema migrations for existing databases
 */
function runMigrations() {
    try {
        // Migration: Add is_credit and fee_hash columns to Etsy_Fees if they don't exist
        const tableInfo = db.pragma('table_info(Etsy_Fees)');
        const hasIsCredit = tableInfo.some(col => col.name === 'is_credit');
        const hasFeeHash = tableInfo.some(col => col.name === 'fee_hash');
        
        if (!hasIsCredit) {
            console.log('📝 Migration: Adding is_credit column to Etsy_Fees...');
            db.exec('ALTER TABLE Etsy_Fees ADD COLUMN is_credit BOOLEAN DEFAULT 0');
            console.log('✅ is_credit column added');
        }
        
        if (!hasFeeHash) {
            console.log('📝 Migration: Adding fee_hash column to Etsy_Fees...');
            db.exec('ALTER TABLE Etsy_Fees ADD COLUMN fee_hash TEXT UNIQUE');
            console.log('✅ fee_hash column added');
        }

        const hasImportLocks = db.prepare(`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Import_Locks'
        `).get();

        if (!hasImportLocks) {
            console.log('📝 Migration: Creating Import_Locks table...');
            db.exec(`
                CREATE TABLE IF NOT EXISTS Import_Locks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    month TEXT NOT NULL,
                    locked_by TEXT,
                    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    note TEXT,
                    UNIQUE(source, month)
                )
            `);
            console.log('✅ Import_Locks table created');
        }
    } catch (error) {
        // Columns might already exist, that's fine
        if (!error.message.includes('already exists')) {
            console.warn('⚠️ Migration warning:', error.message);
        }
    }
}

// Initialize on module load
initializeDatabase();

export default db;
