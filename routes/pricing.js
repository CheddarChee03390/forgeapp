// Pricing Routes
import express from 'express';
import pricingService from '../services/pricingService.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { validateBatchOperation } from '../utils/validators.js';

const router = express.Router();

// Calculate all prices and populate staging
router.post('/calculate', asyncHandler(async (req, res) => {
    const result = pricingService.calculateAllPrices();
    res.json(result);
}));

// Get all staged prices
router.get('/staged', asyncHandler(async (req, res) => {
    const { status } = req.query;
    const prices = status 
        ? pricingService.getByStatus(status)
        : pricingService.getAllStaged();
    res.json(prices);
}));

// Get pricing stats
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = pricingService.getStats();
    res.json(stats);
}));

// Approve variations
router.post('/approve', asyncHandler(async (req, res) => {
    const { variationSkus } = req.body;
    if (!Array.isArray(variationSkus) || variationSkus.length === 0) {
        throw new ValidationError('variationSkus array required', ['SKU array must not be empty']);
    }
    const result = pricingService.approveVariations(variationSkus);
    res.json(result);
}));

// Reject variations
router.post('/reject', asyncHandler(async (req, res) => {
    const { variationSkus } = req.body;
    if (!Array.isArray(variationSkus) || variationSkus.length === 0) {
        throw new ValidationError('variationSkus array required', ['SKU array must not be empty']);
    }
    const result = pricingService.rejectVariations(variationSkus);
    res.json(result);
}));

// Mark as pushed to Etsy
router.post('/mark-pushed', asyncHandler(async (req, res) => {
    const { variationSkus } = req.body;
    if (!Array.isArray(variationSkus) || variationSkus.length === 0) {
        throw new ValidationError('variationSkus array required', ['SKU array must not be empty']);
    }
    const result = pricingService.markAsPushed(variationSkus);
    res.json(result);
}));

// Push prices to Etsy
router.post('/push-to-etsy', async (req, res) => {
    console.log('\n🚀 POST /api/pricing/push-to-etsy called');
    
    try {
        const { variationSkus } = req.body;
        console.log(`   - Received ${variationSkus?.length || 0} variation SKUs`);
        
        if (!Array.isArray(variationSkus) || variationSkus.length === 0) {
            console.error('   ❌ Invalid request: variationSkus array required');
            return res.status(400).json({ error: 'variationSkus array required' });
        }

        // Get approved prices for these variations
        console.log('   - Fetching approved prices...');
        const priceUpdates = pricingService.getApprovedPricesForPush(variationSkus);
        console.log(`   - Found ${priceUpdates.length} approved prices`);
        
        if (priceUpdates.length === 0) {
            console.error('   ❌ No approved prices found');
            return res.status(400).json({ error: 'No approved prices found for selected variations' });
        }
        
        console.log('   - Price updates to process:');
        priceUpdates.forEach(p => {
            console.log(`     • ${p.variation_sku}: Listing ${p.listing_id}, New Price: £${p.new_price}`);
        });

        // Push to Etsy API
        console.log('   - Calling etsyService.updatePrices...');
        const etsyService = (await import('../services/etsyService.js')).default;
        const results = await etsyService.updatePrices(priceUpdates);

        console.log(`   - Results: ${results.successful.length} successful, ${results.failed.length} failed`);
        
        // Mark successful ones as pushed
        if (results.successful.length > 0) {
            console.log(`   - Marking ${results.successful.length} as pushed...`);
            pricingService.markAsPushed(results.successful);
        }

        console.log('✅ Push to Etsy complete');
        res.json({
            success: true,
            pushed: results.successful.length,
            failed: results.failed.length,
            details: results
        });
    } catch (error) {
        console.error('❌ Push to Etsy error:', error);
        console.error(error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update margin modifier for a variation
router.post('/update-modifier', (req, res) => {
    try {
        const { variationSku, marginModifier } = req.body;
        pricingService.updateMarginModifier(variationSku, marginModifier);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
