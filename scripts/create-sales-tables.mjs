// Create Sales & Tax Analytics Tables
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/forge.db');
const db = new Database(DB_PATH);

console.log('🔄 Creating Sales & Tax Analytics tables...\n');

try {
    // 1. Create Material_Costs table
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
    console.log('✅ Created Material_Costs table');

    // 2. Create Sales table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Sales (
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES Etsy_Inventory(listing_id)
        )
    `);
    console.log('✅ Created Sales table');

    // 3. Create Etsy_Fees table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Etsy_Fees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT,
            fee_type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            charged_date DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES Sales(order_id)
        )
    `);
    console.log('✅ Created Etsy_Fees table');

    // 4. Create Monthly_Reports table
    db.exec(`
        CREATE TABLE IF NOT EXISTS Monthly_Reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            total_revenue REAL DEFAULT 0,
            total_material_costs REAL DEFAULT 0,
            total_etsy_fees REAL DEFAULT 0,
            total_net_profit REAL DEFAULT 0,
            total_units_sold INTEGER DEFAULT 0,
            tax_estimate REAL DEFAULT 0,
            tax_rate REAL DEFAULT 0.25,
            generated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(year, month)
        )
    `);
    console.log('✅ Created Monthly_Reports table');

    // 5. Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_order_id ON Sales(order_id);
        CREATE INDEX IF NOT EXISTS idx_sales_sku ON Sales(sku);
        CREATE INDEX IF NOT EXISTS idx_sales_order_date ON Sales(order_date);
        CREATE INDEX IF NOT EXISTS idx_fees_order_id ON Etsy_Fees(order_id);
        CREATE INDEX IF NOT EXISTS idx_material_costs_current ON Material_Costs(material_id, is_current);
        CREATE INDEX IF NOT EXISTS idx_material_costs_date ON Material_Costs(material_id, effective_date DESC);
        CREATE INDEX IF NOT EXISTS idx_monthly_reports ON Monthly_Reports(year, month)
    `);
    console.log('✅ Created indexes');

    // 6. Migrate existing material costs
    const existingMaterials = db.prepare(`
        SELECT materialId, costPerGram FROM Materials WHERE costPerGram > 0
    `).all();

    if (existingMaterials.length > 0) {
        const insertCost = db.prepare(`
            INSERT OR IGNORE INTO Material_Costs 
            (material_id, cost, effective_date, is_current, changed_reason)
            VALUES (?, ?, datetime('2025-01-01'), 1, 'Initial import')
        `);

        for (const mat of existingMaterials) {
            insertCost.run(mat.materialId, mat.costPerGram);
        }
        console.log(`✅ Migrated ${existingMaterials.length} material costs`);
    }

    // 7. Insert sample sales data
    console.log('\n📊 Inserting sample sales data...');
    
    const sampleSales = [
        { order: 'ETY-2025-001', sku: 'PROD-001', name: 'Sample Product 1', qty: 1, price: 45.00, cost: 12.50, date: '2025-01-10' },
        { order: 'ETY-2025-002', sku: 'PROD-002', name: 'Sample Product 2', qty: 2, price: 32.00, cost: 8.00, date: '2025-01-12' },
        { order: 'ETY-2025-003', sku: 'PROD-001', name: 'Sample Product 1', qty: 1, price: 45.00, cost: 12.50, date: '2025-01-15' },
        { order: 'ETY-2025-004', sku: 'PROD-003', name: 'Sample Product 3', qty: 1, price: 28.00, cost: 7.20, date: '2025-01-18' }
    ];

    const insertSale = db.prepare(`
        INSERT OR IGNORE INTO Sales (order_id, sku, product_name, quantity, sale_price, material_cost_at_sale, order_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
    `);

    const insertFee = db.prepare(`
        INSERT OR IGNORE INTO Etsy_Fees (order_id, fee_type, amount, charged_date)
        VALUES (?, 'transaction', ?, ?)
    `);

    for (const sale of sampleSales) {
        insertSale.run(sale.order, sale.sku, sale.name, sale.qty, sale.price, sale.cost, sale.date);
        const fee = (sale.price * 0.065 + 0.20).toFixed(2); // 6.5% + $0.20 Etsy fee
        insertFee.run(sale.order, fee, sale.date);
    }

    console.log(`✅ Inserted ${sampleSales.length} sample sales with fees`);

    console.log('\n✅ Migration complete!');
    console.log('\n📊 Tables created:');
    console.log('  - Material_Costs (historical cost tracking)');
    console.log('  - Sales (orders)');
    console.log('  - Etsy_Fees (transaction fees)');
    console.log('  - Monthly_Reports (cached aggregates)');
    console.log('\n✅ Sample data added - ready to test!');

} catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
}
