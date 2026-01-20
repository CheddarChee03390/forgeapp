# Architecture & Database Schema

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React/VanillaJS)            │
│  Dashboard | Master Stock | Materials | Pricing | Inventory │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (HTTP/JSON)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Backend                       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ Products │Materials │ Pricing  │   Etsy   │  Import  │  │
│  │ Routes   │ Routes   │ Routes   │ Routes   │ Routes   │  │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘  │
│       │          │          │          │          │         │
│       └──────────┴──────────┴──────────┴──────────┴─────┬───┤
│                                                         │   │
│  ┌───────────────────────────────────────────────────┐ │   │
│  │                  Business Logic                   │ │   │
│  │  ┌───────────┐ ┌──────────┐ ┌─────────────────┐ │ │   │
│  │  │ Pricing   │ │ Product  │ │ Etsy OAuth &   │ │ │   │
│  │  │ Calculator│ │ Manager  │ │ API Integration│ │ │   │
│  │  └───────────┘ └──────────┘ └─────────────────┘ │ │   │
│  └───────────────────────────────────────────────────┘ │   │
│                                                         │   │
│  ┌───────────────────────────────────────────────────┐ │   │
│  │            Database Service Layer                 │ │   │
│  │  Schema | Migrations | Connection Management    │ │   │
│  └───────────────────────────────────────────────────┘ │   │
└─────────────────────────┬───────────────────────────────┘   │
                         │                                    │
                         ▼                                    │
         ┌──────────────────────────────┐                    │
         │    SQLite Database           │                    │
         │  (Forge.db)                  │                    │
         └──────────────────────────────┘                    │
         
         ┌──────────────────────────────┐                    │
         │  External API                │                    │
         │  Etsy OAuth + REST API       │                    │
         └──────────────────────────────┘                    │
```

## Database Schema

### Master_Skus
Internal product definitions
```sql
CREATE TABLE Master_Skus (
  id INTEGER PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  type TEXT,                    -- Ring, Chain, Bracelet, etc
  length REAL,
  weight REAL NOT NULL,         -- grams
  material TEXT,
  postageCost REAL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```
**Indexes:** `sku`, `type`, `material`
**Records:** 390

### Materials
Material cost-per-gram rates
```sql
CREATE TABLE Materials (
  materialId TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  costPerGram REAL NOT NULL,     -- cost to source
  sellPricePerGram REAL,         -- markup per gram
  active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP
)
```
**Records:** 14

### Etsy_Inventory
Cached Etsy listing data
```sql
CREATE TABLE Etsy_Inventory (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER UNIQUE,
  shop_id INTEGER,
  title TEXT,
  sku TEXT,
  state TEXT,                    -- active, draft, inactive
  quantity INTEGER,
  price REAL,
  views INTEGER,
  favorites INTEGER,
  created TEXT,
  updated TEXT,
  raw_api_data TEXT,             -- JSON blob
  synced_at TIMESTAMP
)
```
**Indexes:** `listing_id`, `shop_id`, `sku`
**Records:** 314

### Etsy_Variations
Individual Etsy product variations
```sql
CREATE TABLE Etsy_Variations (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER,
  variation_sku TEXT UNIQUE,    -- ETSY_BR_TU15_GP_8
  sku TEXT,                      -- BR_TU15_GP_8
  price REAL,
  quantity INTEGER,
  offering_id INTEGER,           -- Etsy offering ID
  created_at TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES Etsy_Inventory(listing_id)
)
```
**Indexes:** `variation_sku`, `listing_id`, `sku`
**Records:** 490

### Marketplace_Sku_Map
Maps Etsy SKUs to Master SKUs
```sql
CREATE TABLE Marketplace_Sku_Map (
  id INTEGER PRIMARY KEY,
  variation_sku TEXT,            -- Etsy variation
  master_sku TEXT,               -- Internal SKU
  mapped_date TIMESTAMP,
  FOREIGN KEY (master_sku) REFERENCES Master_Skus(sku),
  FOREIGN KEY (variation_sku) REFERENCES Etsy_Variations(variation_sku)
)
```
**Indexes:** `variation_sku`, `master_sku`
**Records:** 490

### Pricing_Staging
Calculated prices pending approval
```sql
CREATE TABLE Pricing_Staging (
  id INTEGER PRIMARY KEY,
  variation_sku TEXT UNIQUE,
  listing_id INTEGER,
  current_price REAL,
  calculated_price REAL,
  price_change_percent REAL,
  target_margin_percent REAL,
  profit REAL,
  profit_margin_percent REAL,
  material_cost REAL,
  transaction_fee REAL,
  payment_fee REAL,
  ad_fee REAL,
  total_fees REAL,
  postage_cost REAL,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected, pushed
  pushed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```
**Indexes:** `status`, `listing_id`, `variation_sku`
**Records:** 758
**Statuses:** 
- pending (awaiting review)
- approved (ready to push)
- rejected (user rejected)
- pushed (sent to Etsy)

### OAuth_Tokens
Etsy API authentication tokens
```sql
CREATE TABLE OAuth_Tokens (
  id INTEGER PRIMARY KEY,
  shop_id INTEGER,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  scope TEXT,
  token_type TEXT,
  created_at TIMESTAMP
)
```
**Records:** 1 (current shop)

### Import_History
Tracks data imports
```sql
CREATE TABLE Import_History (
  id INTEGER PRIMARY KEY,
  import_type TEXT,              -- products, weights, mappings
  file_name TEXT,
  records_imported INTEGER,
  records_skipped INTEGER,
  records_failed INTEGER,
  status TEXT,                   -- success, partial, failed
  errors TEXT,                   -- JSON error details
  imported_at TIMESTAMP
)
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   DATA FLOW                                 │
└─────────────────────────────────────────────────────────────┘

1. INITIAL SETUP
   ┌─────────┐
   │ CSV File│  ───── Import ───────► Master_Skus
   └─────────┘                         Materials
                                       Mappings

2. ETSY SYNC
   ┌────────┐
   │ Etsy   │  ───── OAuth ───────► OAuth_Tokens
   │ API    │  ───── Listings ────► Etsy_Inventory
   └────────┘  ───── Variations ──► Etsy_Variations
                                    Marketplace_Sku_Map

3. PRICING CALCULATION
   ┌──────────────┐
   │ Master_Skus  │  
   │ Materials    │  ──┐
   │ Variations   │    │ Calculate Prices
   │ Postage Costs│    └──► Pricing_Staging
   └──────────────┘           (status=pending)

4. PRICE APPROVAL
   User Reviews ──► Approve/Reject ──► Pricing_Staging
                                       (status=approved/rejected)

5. PUSH TO ETSY
   Approved Prices ──► Update Etsy ──► Etsy_Variations.price
                                       Pricing_Staging(status=pushed)

6. REPORTING
   Pricing_Staging ──► Generate Reports ──► CSV/JSON
   Import_History
```

## Query Patterns

### Get Product Cost Breakdown
```sql
SELECT 
  ps.variation_sku,
  ps.current_price,
  ps.calculated_price,
  ps.material_cost,
  ps.transaction_fee,
  ps.payment_fee,
  ps.postage_cost,
  ps.total_fees,
  ps.profit,
  ps.profit_margin_percent
FROM Pricing_Staging ps
WHERE ps.variation_sku = 'ETSY_BR_TU15_GP_8';
```

### Find Unprofitable Items
```sql
SELECT 
  ps.variation_sku,
  ev.price as current_etsy_price,
  ps.calculated_price,
  ps.profit,
  ms.weight,
  m.name as material
FROM Pricing_Staging ps
JOIN Etsy_Variations ev ON ps.variation_sku = ev.variation_sku
JOIN Marketplace_Sku_Map msm ON ps.variation_sku = msm.variation_sku
JOIN Master_Skus ms ON msm.master_sku = ms.sku
JOIN Materials m ON ms.material = m.name
WHERE ps.profit < 0
ORDER BY ps.profit ASC;
```

### Pricing Summary by Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(profit_margin_percent) as avg_margin,
  SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as unprofitable
FROM Pricing_Staging
GROUP BY status;
```

## Performance Considerations

### Current Indexes
- Master_Skus(sku) - fast SKU lookups
- Etsy_Variations(variation_sku) - fast sync operations
- Marketplace_Sku_Map(variation_sku, master_sku) - fast mapping
- Pricing_Staging(status, variation_sku) - fast filtering/pushing

### Query Optimization Tips
1. Always filter by indexed columns first
2. Use pagination (LIMIT/OFFSET) for large datasets
3. Denormalize frequently-accessed data
4. Archive old Pricing_Staging records quarterly

### Recommended Additional Indexes
```sql
CREATE INDEX idx_pricing_staging_status_created 
  ON Pricing_Staging(status, created_at);

CREATE INDEX idx_etsy_variations_listing_id 
  ON Etsy_Variations(listing_id);

CREATE INDEX idx_master_skus_material 
  ON Master_Skus(material);
```

## Data Backup Strategy

### Daily Backups
```bash
# Backup location: data/backups/
# Format: forge_backup_YYYY-MM-DD_HH-MM-SS.db
# Retention: 7 days
```

### Export Recommendations
- Weekly: Full data export (JSON)
- Monthly: Pricing reports (CSV)
- Quarterly: Archive old records

## Migration History

### v1 (Initial)
- Core schema: Master_Skus, Materials, Etsy tables
- OAuth_Tokens for authentication

### v2 (Weight Addition)
- Added weight field to Master_Skus
- Populated from Etsy descriptions via regex

### v3 (Future Considerations)
- Product history/versioning
- Price change audit trail
- Customer segments/tiers
