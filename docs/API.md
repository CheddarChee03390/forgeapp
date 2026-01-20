# API Documentation

## Overview
REST API endpoints for managing products, materials, pricing, and Etsy inventory.

## Base URL
```
http://localhost:3003/api
```

---

## 🔐 Authentication

### OAuth 2.0 Flow
```
GET /oauth/auth-url
```
Returns the Etsy OAuth authorization URL

```
GET /oauth/callback?code={code}&state={state}
```
Handles OAuth redirect from Etsy

---

## 📦 Products API

### Get All Products
```
GET /products
```
**Response:**
```json
[
  {
    "sku": "BR_TU15_GP_8",
    "type": "Bracelet",
    "length": 8,
    "weight": 45.5,
    "material": "Silver gold Plated",
    "postageCost": 8.9,
    "costPerGram": 6.82,
    "costOfItem": 310.21
  }
]
```

### Get Product by SKU
```
GET /products/:sku
```

### Create Product
```
POST /products
```
**Body:**
```json
{
  "sku": "BR_NEW_GP_8",
  "type": "Bracelet",
  "length": 8,
  "weight": 45.5,
  "material": "1", // materialId
  "postageCost": 8.9
}
```

### Update Product
```
PUT /products/:sku
```

### Delete Product
```
DELETE /products/:sku
```

---

## 🎨 Materials API

### Get All Materials
```
GET /materials
```
**Response:**
```json
[
  {
    "materialId": "1",
    "name": "Silver gold Plated",
    "costPerGram": 6.82,
    "sellPricePerGram": 8.5
  }
]
```

### Create Material
```
POST /materials
```
**Body:**
```json
{
  "name": "Sterling Silver",
  "costPerGram": 0.50,
  "sellPricePerGram": 0.75
}
```

### Update Material
```
PUT /materials/:materialId
```

### Delete Material
```
DELETE /materials/:materialId
```

---

## 💰 Pricing API

### Calculate All Prices
```
POST /pricing/calculate
```
**Response:**
```json
{
  "success": true,
  "total": 758,
  "calculated": 758,
  "skipped": 0,
  "message": "Calculated 758 variation prices"
}
```

### Get Pricing Stats
```
GET /pricing/stats
```
**Response:**
```json
{
  "total": 758,
  "listings": 314,
  "pending": 180,
  "approved": 450,
  "rejected": 0,
  "pushed": 128,
  "avg_margin": 10.5,
  "negative_profit": 2
}
```

### Get Staged Prices
```
GET /pricing/staged
```
**Query Params:**
- `status`: pending|approved|rejected|pushed
- `limit`: 50
- `offset`: 0

**Response:**
```json
[
  {
    "variation_sku": "ETSY_BR_TU15_GP_8",
    "listing_id": 1796508721,
    "current_price": 368.99,
    "calculated_price": 510.99,
    "price_change_percent": 38.3,
    "status": "pending",
    "profit_margin_percent": 10.2
  }
]
```

### Update Price Status
```
PUT /pricing/:variationSku/status
```
**Body:**
```json
{
  "status": "approved", // or rejected
  "margin_override": 12.5
}
```

### Push Selected Prices to Etsy
```
POST /pricing/push
```
**Body:**
```json
{
  "variation_skus": [
    "ETSY_BR_TU15_GP_8",
    "ETSY_BR_TU15_GP_9"
  ]
}
```
**Response:**
```json
{
  "success": true,
  "processed": 302,
  "failed": 8,
  "details": {
    "successful": 302,
    "failed": 8
  }
}
```

---

## 🛍️ Etsy Inventory API

### Get Connected Status
```
GET /etsy/status
```
**Response:**
```json
{
  "connected": true,
  "shop_id": 45254745,
  "expires_at": "2026-01-19T14:01:34.137Z"
}
```

### Get Etsy Listings
```
GET /etsy/listings
```
**Query Params:**
- `state`: active|draft|inactive
- `search`: keyword search

**Response:**
```json
{
  "listings": [
    {
      "listing_id": 1796508721,
      "title": "9ct Gold On Silver Chaps Curb Bracelet",
      "sku": "BR_TU15_GP",
      "quantity": 10,
      "price": 368.99,
      "state": "active",
      "created": "2025-12-01",
      "updated": "2026-01-19"
    }
  ],
  "total": 314
}
```

### Get Listing Variations
```
GET /etsy/:listing_id/variations
```
**Response:**
```json
[
  {
    "variation_sku": "ETSY_BR_TU15_GP_8",
    "sku": "BR_TU15_GP_8",
    "quantity": 10,
    "price": 368.99,
    "offering_id": 22814421063
  }
]
```

### Sync Etsy Data
```
POST /etsy/sync
```
Fetches all listings and variations from Etsy shop

**Response:**
```json
{
  "success": true,
  "listings_synced": 314,
  "variations_synced": 490,
  "last_sync": "2026-01-19T14:01:34.137Z"
}
```

### Export Unmapped Items
```
GET /etsy/export/unmapped
```
Returns CSV of variations without Master SKU mapping

---

## 📥 Import API

### Upload CSV
```
POST /import/upload
```
**Multipart Form Data:**
- `file`: CSV file
- `type`: products|mappings|weights

**CSV Format for Products:**
```
SKU,Type,Weight,Material,PostageCost
BR_TU15_GP_8,Bracelet,45.5,Silver gold Plated,8.9
```

**Response:**
```json
{
  "success": true,
  "imported": 45,
  "errors": 0,
  "warnings": []
}
```

---

## 🔄 Data Import/Export

### Export All Data
```
GET /export/all
```
Returns complete database dump as JSON

### Export Pricing Report
```
GET /export/pricing-report
```
Returns CSV with all pricing data

### Backup Database
```
POST /export/backup
```
Creates timestamped database backup

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid input",
  "details": "Weight must be a positive number"
}
```

### 401 Unauthorized
```json
{
  "error": "Not authenticated",
  "message": "Please connect to Etsy first"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "resource": "Product SKU_NOT_EXIST"
}
```

### 500 Server Error
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## Rate Limiting
- **Products:** 100 req/min per IP
- **Etsy API:** 1000 req/hr (Etsy limit)
- **Pricing:** 10 calculations/min

---

## Webhooks (Future)
```
POST /webhooks/etsy/inventory-update
POST /webhooks/pricing/completed
```

---

## Code Examples

### JavaScript/Fetch
```javascript
// Get all products
const products = await fetch('/api/products')
  .then(r => r.json());

// Calculate prices
const result = await fetch('/api/pricing/calculate', {
  method: 'POST'
}).then(r => r.json());

// Push prices to Etsy
const push = await fetch('/api/pricing/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    variation_skus: ['ETSY_BR_TU15_GP_8']
  })
}).then(r => r.json());
```

### cURL
```bash
# Get stats
curl http://localhost:3003/api/pricing/stats

# Calculate prices
curl -X POST http://localhost:3003/api/pricing/calculate

# Get listings
curl http://localhost:3003/api/etsy/listings
```

---

## Pagination
Most list endpoints support:
```
GET /api/products?limit=50&offset=100
```

Returns:
```json
{
  "data": [...],
  "total": 390,
  "limit": 50,
  "offset": 100
}
```
