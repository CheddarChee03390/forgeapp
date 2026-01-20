# Forge App - Project Structure & Organization Guide

## 📁 Current Directory Structure

```
forge-app/
├── public/                          # Frontend assets & HTML pages
│   ├── index.html                   # Dashboard
│   ├── etsy.html/js                 # Etsy inventory management
│   ├── products.html/js             # Master stock management
│   ├── materials.html/js            # Material costs management
│   ├── pricing.html/js              # Pricing calculator & staging
│   ├── import-v2.html/js            # Data import interface
│   └── styles.css                   # Global styling
│
├── services/                        # Business logic & integrations
│   ├── database.js                  # SQLite database setup & schema
│   ├── etsyService.js               # Etsy API operations
│   ├── etsyOAuthService.js          # OAuth 2.0 authentication
│   ├── pricingService.js            # Pricing calculations
│   ├── productService.js            # Product CRUD operations
│   ├── materialService.js           # Material cost management
│   └── storage.js                   # Local data persistence
│
├── routes/                          # Express API endpoints
│   ├── etsy.js                      # Etsy inventory routes
│   ├── materials.js                 # Material management routes
│   ├── oauth.js                     # OAuth callback routes
│   ├── pricing.js                   # Pricing routes
│   └── products.js                  # Product management routes
│
├── data/                            # Runtime data
│   └── forge.db                     # SQLite database file
│
├── scripts/                         # Utility scripts (to organize)
│   ├── check-failed-ring-prices.mjs
│   ├── check-failed.mjs
│   └── [other check/debug scripts]
│
├── server.js                        # Express server entry point
├── package.json                     # Dependencies & scripts
├── .env                             # Environment variables (local)
├── .env.example                     # Environment template
└── .gitignore                       # Git ignore rules
```

## 🔧 Current System Overview

### Core Functionality
1. **Product Management** - Master Stock database with weights, materials, costs
2. **Material Costs** - Per-gram pricing for different materials
3. **Pricing Engine** - Weight-based calculation with margin control
4. **Etsy Integration** - OAuth 2.0, inventory sync, price pushing
5. **Data Import** - CSV upload for bulk data management

### Key Statistics
- **490 Etsy Variations** total
- **390 Master SKUs** with complete weight data
- **758 Priceable Items** calculated with 0 skipped
- **14 Material Types** configured
- **6 Main UI Pages** + 5 API services

## 📊 Database Schema

### Core Tables
- `Master_Skus` - Product definitions with weights (390 records)
- `Etsy_Inventory` - Etsy listing metadata
- `Etsy_Variations` - Individual product variations (490 records)
- `Marketplace_Sku_Map` - Internal ↔ Etsy SKU mappings
- `Pricing_Staging` - Calculated prices pending review (758 records)
- `Materials` - Cost-per-gram rates (14 types)
- `OAuth_Tokens` - Etsy API authentication

## 🎯 Recommended Folder Reorganization

```
forge-app/
├── src/                             # Source code
│   ├── public/                      # Frontend
│   │   ├── pages/                   # HTML pages
│   │   │   ├── dashboard.html
│   │   │   ├── inventory.html
│   │   │   ├── master-stock.html
│   │   │   ├── materials.html
│   │   │   ├── pricing.html
│   │   │   └── import.html
│   │   ├── js/                      # Frontend scripts
│   │   │   ├── pages/
│   │   │   │   ├── dashboard.js
│   │   │   │   ├── inventory.js
│   │   │   │   ├── master-stock.js
│   │   │   │   ├── materials.js
│   │   │   │   ├── pricing.js
│   │   │   │   └── import.js
│   │   │   └── shared/
│   │   │       ├── api-client.js    # Centralized API calls
│   │   │       ├── utils.js         # Helper functions
│   │   │       └── formatters.js    # Data formatters
│   │   └── styles/
│   │       ├── main.css
│   │       ├── components.css
│   │       ├── layouts.css
│   │       └── responsive.css
│   │
│   ├── server/
│   │   ├── services/
│   │   │   ├── database/
│   │   │   │   ├── index.js
│   │   │   │   └── schema.js
│   │   │   ├── etsy/
│   │   │   │   ├── api.js           # API wrapper
│   │   │   │   ├── oauth.js         # OAuth flow
│   │   │   │   └── sync.js          # Data sync
│   │   │   ├── pricing/
│   │   │   │   ├── calculator.js
│   │   │   │   └── validator.js
│   │   │   ├── products/
│   │   │   │   └── manager.js
│   │   │   ├── materials/
│   │   │   │   └── manager.js
│   │   │   └── storage/
│   │   │       └── index.js
│   │   │
│   │   ├── routes/
│   │   │   ├── api/
│   │   │   │   ├── auth.js
│   │   │   │   ├── inventory.js
│   │   │   │   ├── products.js
│   │   │   │   ├── materials.js
│   │   │   │   └── pricing.js
│   │   │   └── index.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── errorHandler.js
│   │   │   └── logger.js
│   │   │
│   │   ├── utils/
│   │   │   ├── validators.js
│   │   │   └── helpers.js
│   │   │
│   │   └── server.js                # Entry point
│   │
│   ├── models/                      # Data models (if used)
│   └── config/
│       ├── database.js
│       ├── etsy.js
│       └── pricing.js
│
├── scripts/                         # One-time & maintenance scripts
│   ├── migrations/                  # Database migrations
│   │   ├── v1-initial.mjs
│   │   └── v2-add-weights.mjs
│   ├── imports/                     # Data import helpers
│   │   ├── import-weights.mjs
│   │   └── import-mappings.mjs
│   ├── maintenance/                 # Maintenance tasks
│   │   ├── backup-database.mjs
│   │   ├── export-data.mjs
│   │   └── validate-data.mjs
│   └── dev/                         # Development helpers
│       ├── seed-data.mjs
│       └── test-apis.mjs
│
├── data/                            # Data files
│   ├── db/
│   │   └── forge.db
│   ├── exports/                     # Generated exports
│   └── backups/                     # Database backups
│
├── docs/                            # Documentation
│   ├── README.md                    # Main documentation
│   ├── ARCHITECTURE.md              # System design
│   ├── API.md                       # API endpoints
│   ├── DATABASE.md                  # Schema & queries
│   ├── SETUP.md                     # Installation guide
│   ├── DEPLOYMENT.md                # Production deployment
│   └── TROUBLESHOOTING.md           # Common issues
│
├── config/
│   ├── .env.example
│   └── .env                         # Local only
│
├── tests/                           # Test files (future)
│   ├── unit/
│   └── integration/
│
├── package.json
├── .gitignore
└── .prettierrc                      # Code formatting
```

## 🚀 Improvement Suggestions

### HIGH PRIORITY

#### 1. **API Client Abstraction** (Reduce duplication)
- Create centralized `api-client.js` for all fetch calls
- Eliminates repeated error handling code
- Easier to add logging/debugging

#### 2. **Error Handling & Logging**
- Implement middleware for centralized error handling
- Add structured logging (timestamps, levels)
- Create error recovery mechanisms

#### 3. **Database Migration System**
- Version control database schema
- Automated migration runner
- Rollback capability

#### 4. **Input Validation**
- Server-side validation for all endpoints
- Consistent error responses
- Rate limiting on API calls

#### 5. **Testing Framework**
- Unit tests for pricing calculations
- Integration tests for Etsy API
- End-to-end tests for critical flows

### MEDIUM PRIORITY

#### 6. **Authentication & Authorization**
- Current: Basic OAuth only
- Add: Role-based access control (RBAC)
- Add: API key management for integrations

#### 7. **Caching Strategy**
- Cache Etsy material rates (5 min refresh)
- Cache pricing calculations (until prices change)
- Reduce API calls to Etsy

#### 8. **Bulk Operations**
- Batch price updates (50+ at once)
- Bulk weight import from Etsy
- Automated reconciliation

#### 9. **Monitoring & Analytics**
- Price change tracking (history)
- Margin analysis by product type
- Conversion rate monitoring

#### 10. **Performance Optimization**
- Index database queries on common filters
- Pagination for large result sets
- Lazy-load UI components

### LOW PRIORITY (Nice to Have)

#### 11. **UI/UX Enhancements**
- Dark mode toggle
- Keyboard shortcuts
- Real-time notifications
- Drag-and-drop for bulk operations

#### 12. **Advanced Reporting**
- Profit margin reports
- Stock-out forecasting
- Competitor price tracking
- Seasonal trend analysis

#### 13. **Data Synchronization**
- Two-way sync with Etsy
- Conflict resolution
- Audit trail for all changes

#### 14. **Mobile Responsiveness**
- Optimize for tablets
- Mobile-first design
- Touch-friendly controls

#### 15. **API Documentation**
- OpenAPI/Swagger spec
- Interactive API explorer
- Client SDK generation

## 📋 Migration Checklist

### Phase 1: Structure Reorganization (1-2 hours)
- [ ] Create new directory structure
- [ ] Move files to new locations
- [ ] Update import paths in all files
- [ ] Test all pages load correctly

### Phase 2: Code Organization (2-3 hours)
- [ ] Extract shared logic into `js/shared/`
- [ ] Create API client utility
- [ ] Consolidate error handling
- [ ] Update route imports

### Phase 3: Documentation (1-2 hours)
- [ ] Create comprehensive README
- [ ] Document all API endpoints
- [ ] Create deployment guide
- [ ] Add architecture diagram

### Phase 4: Quick Wins (1-2 hours)
- [ ] Add input validation
- [ ] Implement error boundaries
- [ ] Add loading states
- [ ] Create logging utility

## 📊 Project Health Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Code Organization | 6/10 | 9/10 |
| Documentation | 3/10 | 8/10 |
| Error Handling | 4/10 | 8/10 |
| Test Coverage | 0/10 | 6/10 |
| Performance | 7/10 | 8/10 |
| Security | 6/10 | 8/10 |

## 🎓 Next Steps

1. **Start with structure** - Reorganize folders for clarity
2. **Document everything** - API specs, setup guides, troubleshooting
3. **Improve robustness** - Add validation, error handling, logging
4. **Add testing** - Unit tests for critical functions
5. **Optimize performance** - Database indexing, caching
6. **Enhance UX** - Better feedback, loading states, notifications
