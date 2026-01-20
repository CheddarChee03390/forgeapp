// Etsy Service - Fetch and manage Etsy inventory with OAuth
import db from './database.js';
import etsyOAuthService from './etsyOAuthService.js';

class EtsyService {
    constructor() {
        this.baseUrl = 'https://openapi.etsy.com/v3';
        this.clientId = process.env.ETSY_CLIENT_ID || '';
        this.clientSecret = process.env.ETSY_CLIENT_SECRET || '';
    }

    // Get all cached Etsy listings from local DB
    getAllListings() {
        const stmt = db.prepare(`
            SELECT 
                i.*,
                CASE WHEN m.internal_sku IS NOT NULL THEN 1 ELSE 0 END as is_mapped
            FROM Etsy_Inventory i
            LEFT JOIN Marketplace_Sku_Map m
                ON m.marketplace = 'etsy'
                AND m.variation_sku = COALESCE(i.sku, 'LISTING_' || i.listing_id)
                AND m.is_active = 1
            ORDER BY i.updated_timestamp DESC
        `);
        const listings = stmt.all();
        
        // Add price range for listings with variations
        const priceRangeStmt = db.prepare(`
            SELECT MIN(price) as min_price, MAX(price) as max_price
            FROM Etsy_Variations
            WHERE listing_id = ?
        `);
        
        return listings.map(listing => {
            if (listing.has_variations) {
                const priceRange = priceRangeStmt.get(listing.listing_id);
                if (priceRange && priceRange.min_price !== null && priceRange.max_price !== null) {
                    listing.price_range = {
                        min: priceRange.min_price,
                        max: priceRange.max_price
                    };
                }
            }
            return listing;
        });
    }

    // Get single listing by ID
    getListingById(listingId) {
        const stmt = db.prepare('SELECT * FROM Etsy_Inventory WHERE listing_id = ?');
        return stmt.get(listingId);
    }

    // Search listings
    searchListings(searchTerm) {
        const stmt = db.prepare(`
            SELECT * FROM Etsy_Inventory 
            WHERE title LIKE ? OR sku LIKE ? OR tags LIKE ?
            ORDER BY updated_timestamp DESC
        `);
        const pattern = `%${searchTerm}%`;
        return stmt.all(pattern, pattern, pattern);
    }

    // Fetch listings from Etsy API with OAuth
    async fetchFromEtsy(limit = 100, offset = 0) {
        const shopId = etsyOAuthService.getShopId();
        
        if (!shopId) {
            throw new Error('Not authenticated. Please connect to Etsy first.');
        }

        try {
            const accessToken = await etsyOAuthService.getValidAccessToken();
            // Include Inventory to get full variation pricing in one call!
            const url = `${this.baseUrl}/application/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}&includes=Inventory`;
            const apiKeyHeader = (this.clientId && this.clientSecret)
                ? `${this.clientId}:${this.clientSecret}`
                : undefined;
            
            const response = await fetch(url, {
                headers: {
                    ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Etsy API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching from Etsy:', error);
            throw error;
        }
    }

    // Sync Etsy listings to local database
    async syncListings() {
        try {
            console.log('🔄 Starting Etsy sync...');
            
            let allListingIds = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;

            // First, fetch all listing IDs (fast, no inventory data)
            while (hasMore) {
                const accessToken = await etsyOAuthService.getValidAccessToken();
                const shopId = etsyOAuthService.getShopId();
                const url = `${this.baseUrl}/application/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}`;
                const apiKeyHeader = (this.clientId && this.clientSecret)
                    ? `${this.clientId}:${this.clientSecret}`
                    : undefined;
                
                const response = await fetch(url, {
                    headers: {
                        ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Etsy API error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const listings = data.results || [];
                
                if (listings.length === 0) {
                    hasMore = false;
                } else {
                    allListingIds = allListingIds.concat(listings.map(l => l.listing_id));
                    offset += limit;
                    
                    if (listings.length < limit) {
                        hasMore = false;
                    }
                }
            }

            console.log(`📋 Found ${allListingIds.length} listings, fetching with inventory...`);

            // Now fetch in batches with inventory data (batch endpoint supports includes=Inventory)
            const batchSize = 100;
            let allListingsWithInventory = [];
            
            for (let i = 0; i < allListingIds.length; i += batchSize) {
                const batch = allListingIds.slice(i, i + batchSize);
                const accessToken = await etsyOAuthService.getValidAccessToken();
                const url = `${this.baseUrl}/application/listings/batch?listing_ids=${batch.join(',')}&includes=Inventory`;
                const apiKeyHeader = (this.clientId && this.clientSecret)
                    ? `${this.clientId}:${this.clientSecret}`
                    : undefined;
                
                console.log(`🔑 API Key format: ${apiKeyHeader ? 'clientId:secret (length: ' + apiKeyHeader.length + ')' : 'MISSING'}`);
                
                const response = await fetch(url, {
                    headers: {
                        ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const hasInventory = data.results?.some(l => l.inventory && l.inventory.products);
                    console.log(`📦 Fetched batch ${Math.floor(i / batchSize) + 1}: ${batch.length} listings, ${hasInventory ? 'WITH' : 'NO'} inventory data`);
                    allListingsWithInventory = allListingsWithInventory.concat(data.results || []);
                } else {
                    const errorText = await response.text();
                    console.error(`❌ Batch fetch error (${response.status}): ${errorText}`);
                }
            }

            console.log(`📥 Fetched ${allListingsWithInventory.length} listings with inventory data`);

            // Save listings and their variations to database
            const saved = await this.saveListings(allListingsWithInventory);
            
            console.log(`✅ Sync complete: ${saved} listings`);
            
            return {
                fetched: allListingsWithInventory.length,
                saved: saved,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ Sync failed:', error.message);
            throw error;
        }
    }

    // Save listings to database
    async saveListings(listings) {
        const stmt = db.prepare(`
            INSERT INTO Etsy_Inventory (
                listing_id, title, sku, quantity, price, state,
                created_timestamp, updated_timestamp, url,
                num_favorers, views, tags, materials, shop_section_id,
                has_variations, raw_api_data, last_synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(listing_id) DO UPDATE SET
                title = excluded.title,
                sku = excluded.sku,
                quantity = excluded.quantity,
                price = excluded.price,
                state = excluded.state,
                created_timestamp = excluded.created_timestamp,
                updated_timestamp = excluded.updated_timestamp,
                url = excluded.url,
                num_favorers = excluded.num_favorers,
                views = excluded.views,
                tags = excluded.tags,
                materials = excluded.materials,
                shop_section_id = excluded.shop_section_id,
                has_variations = excluded.has_variations,
                raw_api_data = excluded.raw_api_data,
                last_synced = excluded.last_synced
        `);

        const now = Math.floor(Date.now() / 1000);
        let saved = 0;

        for (const listing of listings) {
            try {
                // Extract SKU: prefer inventory SKU first, then listing skus array
                let sku = null;
                if (listing.inventory?.products?.length > 0) {
                    sku = listing.inventory.products[0].sku;
                } else if (listing.skus?.length > 0) {
                    sku = listing.skus[0];
                }
                
                stmt.run(
                    listing.listing_id,
                    listing.title,
                    sku,
                    listing.quantity || 0,
                    listing.price?.amount / listing.price?.divisor || 0,
                    listing.state,
                    listing.created_timestamp,
                    listing.updated_timestamp,
                    listing.url,
                    listing.num_favorers || 0,
                    listing.views || 0,
                    listing.tags?.join(', ') || null,
                    listing.materials?.join(', ') || null,
                    listing.shop_section_id || null,
                    listing.has_variations ? 1 : 0,
                    JSON.stringify(listing), // Store complete raw API response
                    now
                );
                saved++;

                // Save variations if inventory data is included
                if (listing.has_variations && listing.inventory?.products) {
                    const varCount = await this.saveVariationsFromInventory(listing.listing_id, listing.inventory);
                    console.log(`    💎 Saved ${varCount} variations for listing ${listing.listing_id}`);
                } else if (listing.has_variations) {
                    console.log(`    ⚠️  Listing ${listing.listing_id} has_variations but NO inventory data`);
                }
            } catch (error) {
                console.error(`Error saving listing ${listing.listing_id}:`, error.message);
            }
        }

        return saved;
    }

    // Fetch variations for a listing from Etsy API
    async fetchVariations(listingId) {
        try {
            const accessToken = await etsyOAuthService.getValidAccessToken();
            const url = `${this.baseUrl}/application/listings/${listingId}/inventory`;
            const apiKeyHeader = (this.clientId && this.clientSecret)
                ? `${this.clientId}:${this.clientSecret}`
                : this.clientId;
            
            const response = await fetch(url, {
                headers: {
                    'x-api-key': apiKeyHeader,
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                // 404 means no inventory/variations endpoint, which is fine
                if (response.status === 404) {
                    return { offerings: [] };
                }
                throw new Error(`Etsy API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching variations for listing ${listingId}:`, error.message);
            return { offerings: [] };
        }
    }

    // Push updated SKUs for a listing back to Etsy (prefixing variants)
    async pushPrefixedSkus(listingId, prefix = 'ETSY_') {
        console.log(`\n📌 pushPrefixedSkus START: listingId=${listingId}, prefix=${prefix}`);
        
        if (!prefix) throw new Error('Prefix is required');

        console.log('📌 Getting access token...');
        const accessToken = await etsyOAuthService.getValidAccessToken();
        const url = `${this.baseUrl}/application/listings/${listingId}/inventory`;
        const apiKeyHeader = (this.clientId && this.clientSecret)
            ? `${this.clientId}:${this.clientSecret}`
            : undefined;

        console.log(`📌 Fetching current inventory from: ${url}`);
        // Fetch current inventory from Etsy so we can preserve all required fields
        const current = await fetch(url, {
            headers: {
                ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!current.ok) {
            const text = await current.text();
            throw new Error(`Fetch inventory failed: ${current.status} ${current.statusText} ${text}`);
        }

        const payload = await current.json();
        const products = payload.products || [];
        console.log(`📌 Fetched ${products.length} products`);

        // Per Etsy docs: remove product_id, offering_id, scale_name, is_deleted, value_pairs
        // Convert price from Money object to decimal, and prefix SKUs
        for (const product of products) {
            // Remove read-only product fields
            delete product.product_id;
            delete product.is_deleted;

            // Prefix product-level SKU if present
            if (product.sku && !product.sku.startsWith(prefix)) {
                product.sku = `${prefix}${product.sku}`;
            }
            
            // Clean property_values - remove scale_name but keep scale_id (can be number or null)
            if (Array.isArray(product.property_values)) {
                for (const pv of product.property_values) {
                    delete pv.scale_name;
                    if (pv.value_pairs) delete pv.value_pairs;
                }
            }
            
            // Process offerings
            if (Array.isArray(product.offerings)) {
                for (const off of product.offerings) {
                    // Remove read-only offering fields
                    delete off.offering_id;
                    delete off.is_deleted;
                    
                    // Convert price from Money object {amount, divisor} to decimal
                    if (off.price && typeof off.price === 'object' && off.price.amount && off.price.divisor) {
                        off.price = off.price.amount / off.price.divisor;
                    }
                    
                    // Prefix SKU if needed
                    if (off.sku && !off.sku.startsWith(prefix)) {
                        off.sku = `${prefix}${off.sku}`;
                    }
                }
            }
        }

        // Build PUT body - note: readiness_states_on_property (plural) not readiness_state_on_property
        const body = JSON.stringify({
            products,
            price_on_property: payload.price_on_property || [],
            quantity_on_property: payload.quantity_on_property || [],
            sku_on_property: payload.sku_on_property || [],
            readiness_states_on_property: payload.readiness_states_on_property || []
        });

        const updateResp = await fetch(url, {
            method: 'PUT',
            headers: {
                ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body
        });

        if (!updateResp.ok) {
            const text = await updateResp.text();
            throw new Error(`PUT inventory failed: ${updateResp.status} ${updateResp.statusText} ${text}`);
        }

        const updated = await updateResp.json();
        return { success: true, updatedProducts: updated.products?.length || 0 };
    }

    // No SKU editing/apply logic kept in read-only mode

    // Save variations from listing.skus array (fast sync)
    saveVariationsFromSkus(listing) {
        const now = Math.floor(Date.now() / 1000);
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO Etsy_Variations (
                listing_id, variation_sku, quantity, price, 
                property_values, last_synced, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let saved = 0;
        for (const sku of listing.skus) {
            const storedSku = sku?.startsWith('ETSY_') ? sku : `ETSY_${sku}`;
            try {
                stmt.run(
                    listing.listing_id,
                    storedSku,
                    listing.quantity || 0,  // Parent quantity
                    listing.price?.amount / listing.price?.divisor || 0,  // Parent price
                    null,
                    now,
                    now,
                    now
                );
                saved++;
            } catch (error) {
                console.error(`Error saving variation ${storedSku}:`, error.message);
            }
        }
        return saved;
    }

    // Save variations from inventory endpoint data (with actual prices)
    async saveVariationsFromInventory(listingId, inventory) {
        const now = Math.floor(Date.now() / 1000);
        const products = inventory.products || [];
        
        if (!products || products.length === 0) {
            console.log(`    ⚠️  No products in inventory for listing ${listingId}`);
            return 0;
        }

        let savedCount = 0;

        const stmt = db.prepare(`
            INSERT INTO Etsy_Variations (
                listing_id, product_id, variation_sku, quantity, price, 
                property_values, last_synced, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(listing_id, product_id) DO UPDATE SET
                variation_sku = excluded.variation_sku,
                quantity = excluded.quantity,
                price = excluded.price,
                property_values = excluded.property_values,
                last_synced = excluded.last_synced,
                updated_at = excluded.updated_at
        `);

        for (const product of products) {
            // SKU is on the product level, not offering level
            if (!product.sku) {
                console.log(`    ⚠️  Product ${product.product_id} has no SKU`);
                continue;
            }

            // Ensure SKU has ETSY_ prefix
            const storedSku = product.sku.startsWith('ETSY_') ? product.sku : `ETSY_${product.sku}`;
            
            if (product.offerings && Array.isArray(product.offerings) && product.offerings.length > 0) {
                // Use the first offering for price/quantity (typically there's only one per product)
                const offering = product.offerings[0];
                
                // Convert price from Money object if needed
                let price = 0;
                if (offering.price) {
                    if (typeof offering.price === 'object' && offering.price.amount && offering.price.divisor) {
                        price = offering.price.amount / offering.price.divisor;
                    } else if (typeof offering.price === 'number') {
                        price = offering.price;
                    }
                }

                try {
                    stmt.run(
                        listingId,
                        product.product_id || null,
                        storedSku,
                        offering.quantity || 0,
                        price,
                        JSON.stringify(product.property_values || null),
                        now,
                        now,
                        now
                    );
                    savedCount++;
                } catch (error) {
                    console.error(`Error saving variation ${storedSku}:`, error.message);
                }
            }
        }

        return savedCount;
    }

    // Save variations for a listing (legacy - kept for compatibility)
    async saveVariations(listing) {
        const now = Math.floor(Date.now() / 1000);
        
        // If listing has SKUs, save them as variations
        if (listing.skus && listing.skus.length > 0) {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO Etsy_Variations (
                    listing_id, variation_sku, quantity, price, 
                    property_values, last_synced, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const sku of listing.skus) {
                const storedSku = sku?.startsWith('ETSY_') ? sku : `ETSY_${sku}`;
                try {
                    stmt.run(
                        listing.listing_id,
                        storedSku,
                        listing.quantity || 0,  // Shared quantity until we get per-variant data
                        listing.price?.amount / listing.price?.divisor || 0,
                        null,  // property_values - would need additional API call to get
                        now,
                        now,
                        now
                    );
                } catch (error) {
                    console.error(`Error saving variation ${sku}:`, error.message);
                }
            }

            return listing.skus.length;
        }

        return 0;
    }

    // Get variations for a listing with internal SKU mapping
    getVariationsForListing(listingId) {
        const stmt = db.prepare(`
            SELECT v.*, m.internal_sku
            FROM Etsy_Variations v
            LEFT JOIN Marketplace_Sku_Map m
              ON m.marketplace = 'etsy' 
              AND m.variation_sku = v.variation_sku
              AND m.is_active = 1
            WHERE v.listing_id = ?
            ORDER BY v.variation_sku
        `);
        return stmt.all(listingId);
    }

    // Save/overwrite mapping of variation SKU to internal SKU
    saveVariationMapping(variationSku, internalSku) {
        const now = Math.floor(Date.now() / 1000);
        const stmt = db.prepare(`
            INSERT INTO Marketplace_Sku_Map (marketplace, variation_sku, internal_sku, updated_at)
            VALUES ('etsy', ?, ?, ?)
            ON CONFLICT(marketplace, variation_sku)
            DO UPDATE SET internal_sku = excluded.internal_sku, updated_at = excluded.updated_at
        `);
        stmt.run(variationSku, internalSku || null, now);
        return true;
    }
    // List all mappings for Etsy marketplace
    getAllMappings() {
        const stmt = db.prepare(`
            SELECT marketplace, variation_sku, internal_sku, updated_at
            FROM Marketplace_Sku_Map
            WHERE marketplace = 'etsy'
            ORDER BY updated_at DESC, variation_sku ASC
        `);
        return stmt.all();
    }
    // Delete a mapping by variation SKU
    deleteMapping(variationSku) {
        const stmt = db.prepare(`
            DELETE FROM Marketplace_Sku_Map
            WHERE marketplace = 'etsy' AND variation_sku = ?
        `);
        stmt.run(variationSku);
        return true;
    }

    // Simulate CSV import for SKU mappings
    simulateMappingImport(rows, mode = 'both') {
        if (!Array.isArray(rows)) throw new Error('data must be an array');
        const toAdd = [];
        const toUpdate = [];
        const toSkip = [];
        const errors = [];

        const existsStmt = db.prepare(`
            SELECT 1 FROM Marketplace_Sku_Map WHERE marketplace = 'etsy' AND variation_sku = ?
        `);

        rows.forEach((row, idx) => {
            const variation = (row.variation_sku ?? row.variationSku ?? '').toString().trim();
            const internal = (row.internal_sku ?? row.internalSku ?? '').toString().trim();
            if (!variation || !internal) {
                errors.push({ row: idx + 1, error: 'variation_sku and internal_sku are required' });
                return;
            }
            const exists = !!existsStmt.get(variation);
            if (exists) {
                if (mode === 'add') toSkip.push({ row: idx + 1, variation_sku: variation });
                else toUpdate.push({ row: idx + 1, variation_sku: variation });
            } else {
                if (mode === 'update') toSkip.push({ row: idx + 1, variation_sku: variation });
                else toAdd.push({ row: idx + 1, variation_sku: variation });
            }
        });

        return { toAdd, toUpdate, toSkip, errors };
    }

    // Execute CSV import for SKU mappings
    importMappings(rows, mode = 'both') {
        if (!Array.isArray(rows)) throw new Error('data must be an array');
        const result = { success: [], errors: [], skipped: [] };
        const existsStmt = db.prepare(`
            SELECT 1 FROM Marketplace_Sku_Map WHERE marketplace = 'etsy' AND variation_sku = ?
        `);

        rows.forEach((row, idx) => {
            try {
                const variation = (row.variation_sku ?? row.variationSku ?? '').toString().trim();
                const internal = (row.internal_sku ?? row.internalSku ?? '').toString().trim();
                if (!variation || !internal) {
                    result.errors.push({ row: idx + 1, variation_sku: variation, error: 'variation_sku and internal_sku are required' });
                    return;
                }
                const exists = !!existsStmt.get(variation);
                if (exists && mode === 'add') {
                    result.skipped.push({ row: idx + 1, variation_sku: variation });
                    return;
                }
                if (!exists && mode === 'update') {
                    result.skipped.push({ row: idx + 1, variation_sku: variation });
                    return;
                }
                this.saveVariationMapping(variation, internal);
                result.success.push({ row: idx + 1, variation_sku: variation });
            } catch (e) {
                result.errors.push({ row: idx + 1, variation_sku: row?.variation_sku, error: e.message });
            }
        });

        return result;
    }
    getSyncStats() {
        const inventoryStats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN has_variations = 1 THEN 1 ELSE 0 END) as with_variations,
                SUM(quantity) as total_quantity,
                SUM(CASE WHEN quantity > 0 AND quantity < 5 THEN 1 ELSE 0 END) as low_stock,
                MAX(last_synced) as last_sync_time
            FROM Etsy_Inventory
        `).get();

        const variationStats = db.prepare(`
            SELECT 
                COUNT(*) as total_variations,
                COUNT(DISTINCT v.variation_sku) as total_unique_variations
            FROM Etsy_Variations v
        `).get();

        const unmappedCount = db.prepare(`
            SELECT COUNT(*) as unmapped_variations
            FROM Etsy_Variations v
            LEFT JOIN Marketplace_Sku_Map m 
                ON m.marketplace = 'etsy' 
                AND m.variation_sku = v.variation_sku
                AND m.is_active = 1
            WHERE m.internal_sku IS NULL OR m.internal_sku = ''
        `).get();

        const mappingStats = db.prepare(`
            SELECT 
                COUNT(*) as total_mappings,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_mappings,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_mappings
            FROM Marketplace_Sku_Map
            WHERE marketplace = 'etsy'
        `).get();

        return {
            ...inventoryStats,
            ...variationStats,
            unmapped_variations: unmappedCount.unmapped_variations,
            ...mappingStats
        };
    }

    // Delete listing from local cache
    deleteListingCache(listingId) {
        const stmt = db.prepare('DELETE FROM Etsy_Inventory WHERE listing_id = ?');
        stmt.run(listingId);
        return true;
    }

    // Clear all cached listings
    clearCache() {
        db.exec('DELETE FROM Etsy_Inventory');
        return true;
    }

    // Update variation price on Etsy
    async updateVariationPrice(listingId, variationSku, newPrice) {
        console.log(`\n🔄 updateVariationPrice called:`);
        console.log(`   - Listing ID: ${listingId}`);
        console.log(`   - Variation SKU: ${variationSku}`);
        console.log(`   - New Price: £${newPrice}`);
        
        const accessToken = await etsyOAuthService.getValidAccessToken();
        const shopId = etsyOAuthService.getShopId();
        
        if (!accessToken) {
            console.error('❌ Not authenticated with Etsy');
            throw new Error('Not authenticated with Etsy. Please connect your shop first.');
        }
        
        console.log(`   - Shop ID: ${shopId}`);
        console.log(`   - Access Token: ${accessToken.substring(0, 20)}...`);

        const getUrl = `${this.baseUrl}/application/listings/${listingId}/inventory`;
        console.log(`   - GET URL: ${getUrl}`);
        
        // Get current inventory structure for the listing
        const response = await fetch(getUrl, {
            method: 'GET',
            headers: {
                'x-api-key': this.clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        console.log(`   - GET Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Failed to get inventory:`, error);
            throw new Error(`Failed to get inventory: ${error}`);
        }

        const inventory = await response.json();
        console.log(`   - Inventory products count: ${inventory.products?.length || 0}`);
        
        // Find the product and offering to update
        let updated = false;
        for (const product of inventory.products) {
            console.log(`   - Checking product SKU: ${product.sku}`);
            // Match by product SKU, not offering SKU
            if (product.sku === variationSku) {
                for (const offering of product.offerings) {
                    console.log(`     - Offering ID: ${offering.offering_id}`);
                    const oldPrice = offering.price.amount / offering.price.divisor;
                    // Convert price to decimal format (per Etsy docs)
                    offering.price = newPrice;
                    console.log(`   ✓ Found product! Old price: £${oldPrice}, New price: £${newPrice}`);
                    updated = true;
                    break;
                }
                break;
            }
        }

        if (!updated) {
            console.error(`❌ Variation SKU ${variationSku} not found in listing ${listingId}`);
            throw new Error(`Variation SKU ${variationSku} not found in listing ${listingId}`);
        }

        const updateUrl = `${this.baseUrl}/application/listings/${listingId}/inventory`;
        console.log(`   - PUT URL: ${updateUrl}`);
        
        // Clean products array per Etsy API requirements
        const cleanedProducts = inventory.products.map(product => {
            const cleanProduct = {
                sku: product.sku,
                property_values: product.property_values?.map(pv => ({
                    property_id: pv.property_id,
                    property_name: pv.property_name,
                    scale_id: pv.scale_id,
                    value_ids: pv.value_ids,
                    values: pv.values
                })) || [],
                offerings: product.offerings?.map(off => ({
                    price: typeof off.price === 'object' ? off.price.amount / off.price.divisor : off.price,
                    quantity: off.quantity,
                    is_enabled: off.is_enabled,
                    readiness_state_id: off.readiness_state_id
                })) || []
            };
            return cleanProduct;
        });
        
        const updateBody = {
            products: cleanedProducts,
            price_on_property: inventory.price_on_property || [],
            quantity_on_property: inventory.quantity_on_property || [],
            sku_on_property: inventory.sku_on_property || []
        };
        console.log(`   - Update body products count: ${updateBody.products.length}`);
        
        // Update the inventory with new price
        const updateResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'x-api-key': this.clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateBody)
        });

        console.log(`   - PUT Response Status: ${updateResponse.status} ${updateResponse.statusText}`);
        
        if (!updateResponse.ok) {
            const error = await updateResponse.text();
            console.error(`❌ Failed to update price:`, error);
            throw new Error(`Failed to update price: ${error}`);
        }

        const result = await updateResponse.json();
        console.log(`✅ Price updated successfully for ${variationSku}`);
        return result;
    }

    // Batch update prices for multiple variations
    async updatePrices(priceUpdates) {
        console.log(`\n📦 Batch updating ${priceUpdates.length} prices...`);
        
        const results = {
            successful: [],
            failed: []
        };

        for (let i = 0; i < priceUpdates.length; i++) {
            const update = priceUpdates[i];
            console.log(`\n[${i + 1}/${priceUpdates.length}] Processing ${update.variation_sku}...`);
            
            try {
                await this.updateVariationPrice(update.listing_id, update.variation_sku, update.new_price);
                results.successful.push(update.variation_sku);
                
                // Update local cache
                const stmt = db.prepare(`
                    UPDATE Etsy_Variations 
                    SET price = ?, updated_at = ? 
                    WHERE listing_id = ? AND variation_sku = ?
                `);
                const dbResult = stmt.run(update.new_price, Math.floor(Date.now() / 1000), update.listing_id, update.variation_sku);
                console.log(`   - Local cache updated (${dbResult.changes} rows)`);
                
            } catch (error) {
                console.error(`   ❌ Failed: ${error.message}`);
                results.failed.push({
                    variation_sku: update.variation_sku,
                    error: error.message
                });
            }
        }

        console.log(`\n✅ Batch complete: ${results.successful.length} successful, ${results.failed.length} failed`);
        return results;
    }

    // Set API credentials
    setCredentials(apiKey, shopId) {
        this.apiKey = apiKey;
        this.shopId = shopId;
        // Optionally save to a config file or environment
    }

    // Get unmapped variations (no internal SKU mapping)
    getUnmappedVariations() {
        const stmt = db.prepare(`
            SELECT 
                v.listing_id,
                l.title as listing_title,
                v.variation_sku,
                v.price,
                v.quantity
            FROM Etsy_Variations v
            LEFT JOIN Etsy_Inventory l ON v.listing_id = l.listing_id
            LEFT JOIN Marketplace_Sku_Map m 
              ON m.marketplace = 'etsy' 
              AND m.variation_sku = v.variation_sku
              AND m.is_active = 1
            WHERE m.internal_sku IS NULL
            ORDER BY v.listing_id, v.variation_sku
        `);
        return stmt.all();
    }

    // Get listings/variations with missing SKUs
    // This includes:
    // 1. Listings with has_variations=0 but have a parent SKU (type: parent_no_variations)
    // 2. Variations that exist but have NULL SKU (type: variation_missing_sku)
    getMissingSkuData() {
        const results = [];
        
        // 1. Parent listings with SKU but no variations
        const parentsStmt = db.prepare(`
            SELECT 
                listing_id,
                title,
                sku,
                price,
                quantity,
                has_variations,
                'parent_no_variations' as type
            FROM Etsy_Inventory
            WHERE has_variations = 0 
              AND sku IS NOT NULL
              AND sku != ''
            ORDER BY listing_id
        `);
        const parents = parentsStmt.all();
        
        // 2. Variations with NULL or empty SKU
        const variationsStmt = db.prepare(`
            SELECT 
                v.listing_id,
                l.title as listing_title,
                l.has_variations,
                v.variation_sku,
                v.price,
                v.quantity,
                'variation_missing_sku' as type
            FROM Etsy_Variations v
            LEFT JOIN Etsy_Inventory l ON v.listing_id = l.listing_id
            WHERE v.variation_sku IS NULL 
               OR v.variation_sku = ''
               OR v.variation_sku NOT LIKE 'ETSY_%'
            ORDER BY v.listing_id
        `);
        const variations = variationsStmt.all();
        
        // Combine results
        return [...parents, ...variations];
    }

    // Get listings without any SKU assigned in Etsy
    getListingsWithoutSku() {
        const stmt = db.prepare(`
            SELECT 
                listing_id,
                title,
                price,
                has_variations,
                quantity
            FROM Etsy_Inventory
            WHERE sku IS NULL
            ORDER BY title
        `);
        return stmt.all();
    }

    // Get pricing items that are being skipped (no weight/material data)
    getSkippedPricingItems() {
        const stmt = db.prepare(`
            SELECT 
                COALESCE(i.sku, 'LISTING_' || i.listing_id) as sku,
                i.listing_id,
                i.title,
                i.price,
                CASE 
                    WHEN map.internal_sku IS NOT NULL THEN 'Yes'
                    ELSE 'No'
                END as has_mapping,
                m.SKU as master_sku,
                m.Weight as weight_grams
            FROM Etsy_Inventory i
            LEFT JOIN Marketplace_Sku_Map map
                ON map.marketplace = 'etsy' 
                AND map.variation_sku = COALESCE(i.sku, 'LISTING_' || i.listing_id)
                AND map.is_active = 1
            LEFT JOIN Master_Skus m
                ON m.SKU = map.internal_sku
            WHERE i.has_variations = 0
                AND (
                    map.internal_sku IS NULL 
                    OR m.Weight IS NULL
                )
            ORDER BY i.listing_id
        `);
        return stmt.all();
    }
}

export default new EtsyService();
