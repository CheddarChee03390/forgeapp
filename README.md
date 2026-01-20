# 🔨 ForgeApp - E-commerce Management System

A comprehensive inventory, sales, and pricing management system for Etsy sellers. Built for jewelry and handmade product businesses with material cost tracking, dynamic pricing, and sales analytics.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CheddarChee03390/forgeapp.git
   cd forgeapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Etsy API credentials
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open your browser:**
   ```
   http://localhost:3003
   ```

---

## ✨ Features

### 📦 **Master Stock Management**
- Product database with SKU, weight, materials, and costs
- Material cost tracking (cost per gram)
- Automatic material cost calculations
- CSV import/export with preview
- Low stock monitoring

### 🛍️ **Etsy Integration**
- OAuth 2.0 authentication
- Inventory sync (listings, variations, prices)
- Sales order sync with automatic deduplication
- **Cancelled order filtering** (status-based validation)
- SKU mapping between Etsy and internal products
- Price push to Etsy variations

### 💰 **Dynamic Pricing**
- Material cost-based pricing suggestions
- Multiplier-based profit calculations
- Bulk price updates
- Price comparison (current vs suggested)
- Push pricing directly to Etsy

### 📊 **Sales Analytics**
- Revenue, profit, and cost tracking
- Order history with date range filtering
- Product performance analytics
- Etsy fees breakdown
- Tax reporting with VAT calculations
- Export to CSV

### 🔧 **Tools & Utilities**
- Database backup system (daily automatic backups)
- CSV import for bulk updates
- Historical cost tracking
- Price history auditing

---

## 🏗️ Architecture

```
forgeapp/
├── server.js              # Express server entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration (not in repo)
├── data/                  # SQLite databases
│   ├── forge.db          # Main application database
│   └── backups/          # Automatic daily backups
├── public/               # Frontend HTML/CSS/JS
│   ├── index.html        # Dashboard
│   ├── products.html     # Product management
│   ├── etsy.html         # Etsy integration
│   ├── pricing.html      # Pricing calculator
│   └── sales-analytics.html  # Sales reports
├── services/             # Business logic layer
│   ├── etsy/            # Etsy API services
│   ├── sales/           # Sales & analytics
│   ├── database.js      # SQLite connection
│   └── etsyOAuthService.js  # OAuth handler
├── routes/              # Express API routes
├── models/              # Data models
├── middleware/          # Express middleware
├── scripts/             # Utility scripts
└── utils/               # Helper functions
```

---

## 📦 Dependencies

### Core
- **express** (^4.18.2) - Web server framework
- **better-sqlite3** (^12.6.2) - Fast SQLite database
- **dotenv** (^17.2.3) - Environment variable management

### Etsy Integration
- **node-fetch** (^3.3.2) - HTTP client for Etsy API
- **pkce-challenge** (^5.0.1) - OAuth PKCE flow
- **crypto-js** (^4.2.0) - Token encryption

### File Processing
- **csv-parser** (^3.2.0) - CSV import
- **multer** (^2.0.2) - File upload handling

### Authentication
- **express-session** (^1.18.2) - Session management

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Etsy OAuth Configuration
ETSY_CLIENT_ID=your_etsy_keystring_here
ETSY_CLIENT_SECRET=your_etsy_shared_secret_here
ETSY_REDIRECT_URI=http://localhost:3003/oauth/redirect

# Server Configuration
PORT=3003

# Encryption Key (auto-generated)
ENCRYPTION_KEY=generate_with_crypto.randomBytes(32).toString('base64')
```

### Getting Etsy API Credentials:
1. Visit [Etsy Developers](https://www.etsy.com/developers/your-apps)
2. Create a new app or use existing
3. Copy **Keystring** → `ETSY_CLIENT_ID`
4. Copy **Shared Secret** → `ETSY_CLIENT_SECRET`
5. Add redirect URI: `http://localhost:3003/oauth/redirect`

---

## 🗄️ Database Schema

### **Master_Skus** - Product Master Data
```sql
SKU (TEXT PRIMARY KEY)      -- Unique product identifier
Type (TEXT)                 -- Product category
Length (REAL)               -- Product dimension
Weight (REAL)               -- Weight in grams
Material (TEXT)             -- Material ID reference
postagecost (REAL)          -- Shipping cost
```

### **Materials** - Material Cost Tracking
```sql
materialId (TEXT PRIMARY KEY)  -- Material identifier
name (TEXT)                    -- Display name
costPerGram (REAL)             -- Cost per gram
```

### **Sales** - Order Transaction History
```sql
order_id (TEXT UNIQUE)         -- Unique order identifier (etsy-{receipt_id}-{transaction_id})
listing_id (INTEGER)           -- Etsy listing ID
sku (TEXT)                     -- Product SKU
product_name (TEXT)            -- Product title
quantity (INTEGER)             -- Items sold
sale_price (REAL)              -- Unit price
material_cost_at_sale (REAL)   -- Historical material cost
order_date (DATETIME)          -- Order timestamp
status (TEXT)                  -- Order status
```

### **Etsy_Inventory** - Cached Etsy Listings
```sql
listing_id (INTEGER PRIMARY KEY)  -- Etsy listing ID
title (TEXT)                      -- Listing title
sku (TEXT)                        -- Listing SKU
quantity (INTEGER)                -- Available stock
price (REAL)                      -- Current price
has_variations (BOOLEAN)          -- Has variants
last_synced (INTEGER)             -- Sync timestamp
```

### **Marketplace_Sku_Map** - SKU Mapping
```sql
marketplace (TEXT)            -- Platform (e.g., 'etsy')
variation_sku (TEXT)          -- Marketplace SKU
internal_sku (TEXT)           -- Internal product SKU
is_active (BOOLEAN)           -- Mapping status
```

---

## 🛠️ API Endpoints

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product
- `PUT /api/products/:sku` - Update product
- `DELETE /api/products/:sku` - Delete product

### Etsy
- `GET /api/etsy/auth/status` - Check authentication
- `POST /api/etsy/sync` - Sync inventory from Etsy
- `GET /api/etsy/listings` - Get cached listings
- `POST /api/etsy/push-skus` - Push SKUs to Etsy

### Sales
- `POST /api/sales/sync` - Sync orders from Etsy
- `GET /api/sales` - Get sales data
- `GET /api/sales/analytics` - Sales metrics

### Pricing
- `GET /api/pricing/suggestions` - Get pricing recommendations
- `POST /api/pricing/push-to-etsy` - Push prices to Etsy

---

## 🔥 Key Features Explained

### **Cancelled Order Filtering**
The system automatically filters cancelled Etsy orders during sync:
- Uses `receipt.status === 'Canceled'` validation
- Prevents cancelled orders from inflating sales data
- Maintains data integrity with Etsy's actual orders

### **SKU Mapping**
Map Etsy variation SKUs to internal product SKUs:
- Supports multiple marketplaces
- Enables material cost tracking across platforms
- Centralizes product management

### **Dynamic Pricing**
Calculate selling prices based on material costs:
- Formula: `(Material Cost × Multiplier) + Postage`
- Real-time price suggestions
- Bulk update support

### **Sales Analytics**
Comprehensive sales reporting:
- Revenue, profit, and margin tracking
- Product performance analysis
- Etsy fee calculations
- Tax reporting (VAT ready)

---

## 📝 Scripts

### Development
```bash
npm start           # Start production server
npm run dev         # Start with auto-reload (Node 18+)
```

### Utilities
```bash
# Database backups (automatic daily at startup)
node scripts/backup-database.mjs

# Check cancelled orders
node scripts/utilities/check-cancelled.mjs

# Test raw Etsy API
node scripts/utilities/raw-etsy-test.mjs
```

---

## 🔒 Security

- **Environment variables** for sensitive credentials
- **OAuth 2.0** with PKCE for Etsy authentication
- **Encrypted token storage** in database
- **`.gitignore`** configured for:
  - `.env` files
  - Database files
  - Customer data exports
  - Backup archives

---

## 🐛 Troubleshooting

### Etsy Authentication Issues
1. Verify credentials in `.env`
2. Check redirect URI matches exactly
3. Re-authenticate: Click "Connect to Etsy" button

### Database Errors
- Check `data/` directory permissions
- Database backups stored in `data/backups/`
- Restore from backup if corrupted

### Sales Not Syncing
- Ensure Etsy authentication is active
- Check date range (default: last 300 days)
- Verify cancelled orders aren't included

---

## 📚 Documentation

Additional documentation in `/docs`:
- `OAUTH_SETUP.md` - Etsy OAuth configuration
- `OAUTH_UPGRADE.md` - OAuth migration guide
- `MASTER_STOCK_UI_IMPROVEMENTS.md` - UI changelog

---

## 🤝 Contributing

This is a private business application. Not currently accepting external contributions.

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Support

For issues or questions:
- Check existing documentation
- Review error logs in terminal
- Ensure all environment variables are set correctly

---

**Built with ❤️ for small business e-commerce management**
