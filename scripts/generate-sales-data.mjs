// Generate realistic sales data from April 2025 to January 2026
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/forge.db');
const db = new Database(DB_PATH);

const PRODUCTS = [
  { sku: 'SCARF-WOOL-001', name: 'Handmade Wool Scarf - Navy', price: 45.00, cost: 8.50 },
  { sku: 'BEANIE-KNIT-002', name: 'Chunky Knit Beanie - Black', price: 32.00, cost: 5.00 },
  { sku: 'COASTER-CERAMIC-003', name: 'Ceramic Coaster Set (4pc)', price: 22.00, cost: 3.20 },
  { sku: 'MUG-CUSTOM-004', name: 'Personalized Coffee Mug', price: 18.00, cost: 2.80 },
  { sku: 'CANDLE-SOY-005', name: 'Soy Wax Candle - Lavender', price: 28.00, cost: 4.50 },
  { sku: 'TOTE-CANVAS-006', name: 'Canvas Tote Bag - Natural', price: 35.00, cost: 6.20 },
  { sku: 'KEYCHAIN-LEATHER-007', name: 'Leather Keychain', price: 12.00, cost: 1.80 },
  { sku: 'BOOKMARK-WOOD-008', name: 'Wooden Bookmark Set', price: 15.00, cost: 2.40 }
];

// Sales distribution per month (realistic pattern with holiday peaks)
const MONTHLY_SALES = {
  '2025-04': 12,
  '2025-05': 15,
  '2025-06': 14,
  '2025-07': 18,
  '2025-08': 16,
  '2025-09': 12,
  '2025-10': 14,
  '2025-11': 20,  // Holiday season
  '2025-12': 25,  // Peak season
  '2026-01': 10   // Current month
};

function getRandomDate(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return new Date(year, month - 1, day);
}

function getRandomProduct() {
  return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

function getEtsyFee(price) {
  return parseFloat((price * 0.065 + 0.20).toFixed(2));
}

console.log('🚀 Generating sales data from April 2025 to January 2026...\n');

try {
  // Disable foreign keys temporarily
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');
  
  // Clear existing sales
  db.exec('DELETE FROM Sales');
  db.exec('DELETE FROM Etsy_Fees');
  console.log('✓ Cleared existing sales data\n');

  const insertSale = db.prepare(`
    INSERT INTO Sales (order_id, sku, product_name, quantity, sale_price, material_cost_at_sale, order_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
  `);

  const insertFee = db.prepare(`
    INSERT INTO Etsy_Fees (order_id, fee_type, amount, charged_date)
    VALUES (?, 'transaction', ?, ?)
  `);

  let totalSales = 0;
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalFees = 0;

  for (const [monthKey, count] of Object.entries(MONTHLY_SALES)) {
    const [year, month] = monthKey.split('-').map(Number);
    
    for (let i = 0; i < count; i++) {
      const product = getRandomProduct();
      const saleDate = getRandomDate(year, month);
      const orderId = `ETY-${year}-${month.toString().padStart(2, '0')}-${(i + 1).toString().padStart(3, '0')}`;
      const fee = getEtsyFee(product.price);
      
      insertSale.run(
        orderId,
        product.sku,
        product.name,
        1,
        product.price,
        product.cost,
        saleDate.toISOString().split('T')[0],
      );

      insertFee.run(orderId, fee, saleDate.toISOString().split('T')[0]);

      totalSales++;
      totalRevenue += product.price;
      totalCosts += product.cost;
      totalFees += fee;
    }

    console.log(`  ✓ ${monthKey}: ${count} sales`);
  }

  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');

  console.log(`\n✅ Generated ${totalSales} sales!\n`);
  console.log('📊 Summary:');
  console.log(`  Total Revenue:    £${totalRevenue.toFixed(2)}`);
  console.log(`  Total Costs:      £${totalCosts.toFixed(2)}`);
  console.log(`  Total Etsy Fees:  £${totalFees.toFixed(2)}`);
  console.log(`  Gross Profit:     £${(totalRevenue - totalCosts).toFixed(2)}`);
  console.log(`  Net Profit:       £${(totalRevenue - totalCosts - totalFees).toFixed(2)}`);
  console.log(`  Profit Margin:    ${((totalRevenue - totalCosts - totalFees) / totalRevenue * 100).toFixed(1)}%`);

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Error:', error);
  process.exit(1);
}
