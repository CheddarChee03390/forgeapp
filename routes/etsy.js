// Etsy API Routes
import express from 'express';
import etsyService from '../services/etsyService.js';
import etsyOAuthService from '../services/etsyOAuthService.js';
import productService from '../services/productService.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { validateListing } from '../utils/validators.js';

const router = express.Router();

// Get all cached Etsy listings
router.get('/', asyncHandler(async (req, res) => {
    const listings = etsyService.getAllListings();
    res.json(listings);
}));

// Get master SKU list (for mapping selector)
router.get('/config/master-skus', asyncHandler(async (req, res) => {
    const skus = productService.getAll().map(p => ({ sku: p.SKU, type: p.Type }));
    res.json(skus);
}));

// List all Etsy SKU mappings (for Import UI)
router.get('/mappings', asyncHandler(async (req, res) => {
    const mappings = etsyService.getAllMappings();
    res.json(mappings);
}));

// Get variations for a listing
router.get('/:listingId/variations', asyncHandler(async (req, res) => {
    const variations = etsyService.getVariationsForListing(req.params.listingId);
    res.json(variations);
}));

// Update mapping for a variation SKU -> internal SKU
router.post('/:listingId/variations/map', (req, res) => {
    try {
        const { variationSku, internalSku } = req.body;
        if (!variationSku) {
            return res.status(400).json({ error: 'variationSku is required' });
        }
        etsyService.saveVariationMapping(variationSku, internalSku || null);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upsert mapping (global, not tied to listing)
router.post('/mappings', (req, res) => {
    try {
        const { variation_sku, internal_sku } = req.body || {};
        if (!variation_sku) return res.status(400).json({ error: 'variation_sku is required' });
        etsyService.saveVariationMapping(String(variation_sku), internal_sku ? String(internal_sku) : null);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete mapping (global)
router.delete('/mappings/:variationSku', (req, res) => {
    try {
        const { variationSku } = req.params;
        if (!variationSku) return res.status(400).json({ error: 'variationSku is required' });
        etsyService.deleteMapping(String(variationSku));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Simulate mapping import (CSV-driven)
router.post('/mappings/import/simulate', (req, res) => {
    try {
        const { data = [], mode = 'both' } = req.body || {};
        const result = etsyService.simulateMappingImport(data, mode);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Execute mapping import
router.post('/mappings/import/execute', (req, res) => {
    try {
        const { data = [], mode = 'both' } = req.body || {};
        const result = etsyService.importMappings(data, mode);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Removed SKU editing routes for read-only mode

// Prefix and push variation SKUs back to Etsy for a specific listing (must be before /:listingId)
router.post('/:listingId/prefix-skus', (req, res) => {
    (async () => {
        try {
            console.log('🚀 POST /prefix-skus called for listing:', req.params.listingId);
            const { listingId } = req.params;
            const { prefix = 'ETSY_' } = req.body || {};
            if (!listingId) return res.status(400).json({ error: 'listingId is required' });

            console.log(`📍 Calling pushPrefixedSkus(${listingId}, ${prefix})`);
            const result = await etsyService.pushPrefixedSkus(listingId, prefix);
            console.log('✅ Result:', result);
            res.json(result);
        } catch (error) {
            console.error('❌ Error in prefix-skus:', error);
            console.error('Stack:', error.stack);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    })();
});

// Get single listing
router.get('/:listingId', (req, res) => {
    try {
        const listing = etsyService.getListingById(req.params.listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search listings
router.get('/search/:term', (req, res) => {
    try {
        const listings = etsyService.searchListings(req.params.term);
        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync listings from Etsy API
router.post('/sync', async (req, res) => {
    try {
        console.log('🔄 Etsy sync requested');
        console.log('🔍 Checking authentication...');
        
        // Get tokens to verify authentication
        const tokens = etsyOAuthService.getStoredTokens();
        console.log('📌 Token retrieval result:', {
            hasTokens: !!tokens,
            hasAccessToken: !!tokens?.accessToken,
            hasRefreshToken: !!tokens?.refreshToken,
            shopId: tokens?.shopId,
            expiresAt: tokens?.expiresAt ? new Date(tokens.expiresAt).toISOString() : null
        });
        
        if (!tokens || !tokens.accessToken) {
            console.error('❌ Not authenticated - no valid tokens');
            return res.status(401).json({ error: 'Not authenticated. Please connect to Etsy first.' });
        }
        
        console.log('✅ Authentication verified, starting sync...');
        const result = await etsyService.syncListings();
        console.log(`✅ Sync complete: ${result.saved} listings`);
        res.json(result);
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get sync stats
router.get('/stats/summary', (req, res) => {
    try {
        const stats = etsyService.getSyncStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set API credentials
router.post('/config/credentials', (req, res) => {
    try {
        const { apiKey, shopId } = req.body;
        etsyService.setCredentials(apiKey, shopId);
        res.json({ success: true, message: 'Credentials updated' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Clear cache
router.delete('/cache', (req, res) => {
    try {
        etsyService.clearCache();
        res.json({ success: true, message: 'Cache cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export unmapped variations (no internal SKU mapping)
router.get('/export/unmapped', (req, res) => {
    try {
        const unmapped = etsyService.getUnmappedVariations();
        res.json(unmapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export listings/variations with missing SKUs
router.get('/export/missing-sku', (req, res) => {
    try {
        const missingSku = etsyService.getMissingSkuData();
        res.json(missingSku);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export listings without any SKU assigned
router.get('/export/no-sku', (req, res) => {
    try {
        const noSku = etsyService.getListingsWithoutSku();
        const csv = 'Listing ID,Title,Price,Has Variations\n' + 
            noSku.map(item => `"${item.listing_id}","${item.title.replace(/"/g, '""')}","${item.price}","${item.has_variations}"`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="listings-no-sku-' + new Date().toISOString().split('T')[0] + '.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export pricing items that are being skipped (no weight/material data)
router.get('/export/pricing-skipped', (req, res) => {
    try {
        const skipped = etsyService.getSkippedPricingItems();
        const csv = 'Listing ID,SKU,Title,Price,Has Mapping\n' + 
            skipped.map(item => `"${item.listing_id}","${item.sku}","${item.title.replace(/"/g, '""')}","${item.price}","${item.has_mapping}"`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="pricing-skipped-' + new Date().toISOString().split('T')[0] + '.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export skipped pricing items (JSON format)
router.get('/export/skipped-pricing', (req, res) => {
    try {
        const skipped = etsyService.getSkippedPricingItems();
        res.json(skipped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
