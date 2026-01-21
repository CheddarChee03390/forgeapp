// Sales API Routes - Order and transaction tracking
import express from 'express';
import salesService from '../services/salesService.js';
import etsyFeesService from '../services/etsyFeesService.js';
import db from '../services/database.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * DELETE /api/sales/clear
 * Clear all sales data (use with caution!)
 */
router.delete('/clear', asyncHandler(async (req, res) => {
    const result = salesService.clearAllSales();
    
    res.json({
        success: true,
        message: 'All sales data cleared',
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/sync
 * Sync orders from Etsy API
 * Query: ?days=30 (default 30)
 */
router.get('/sync', asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    
    if (days < 1 || days > 365) {
        throw new ValidationError('Invalid days parameter', ['days must be between 1 and 365']);
    }
    
    const result = await salesService.syncOrdersFromEtsy(days);
    
    const response = {
        success: result.success,
        message: result.message,
        synced: result.synced || 0,
        timestamp: new Date().toISOString(),
        error: result.error || null
    };
    
    res.json(response);
}));

/**
 * GET /api/sales/range
 * Get sales for date range
 * Query: ?startDate=2025-01-01&endDate=2025-01-31
 */
router.get('/range', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        throw new ValidationError('Missing parameters', ['startDate and endDate required']);
    }
    
    const sales = salesService.getSalesByDateRange(startDate, endDate);
    
    res.json({
        success: true,
        date_range: { start: startDate, end: endDate },
        count: sales.length,
        data: sales,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/order/:orderId
 * Get sale by Etsy order ID
 */
router.get('/order/:orderId', asyncHandler(async (req, res) => {
    const sale = salesService.getSaleByOrderId(req.params.orderId);
    
    if (!sale) {
        throw new NotFoundError(`Order ${req.params.orderId} not found`);
    }
    
    res.json({
        success: true,
        data: sale,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/month/:year/:month
 * Get all sales for a month
 */
router.get('/month/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    
    // Validate
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) {
        throw new ValidationError('Invalid format', ['year must be YYYY, month must be 1-12']);
    }
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const sales = salesService.getSalesForMonth(parseInt(year), m);
    
    res.json({
        success: true,
        year: parseInt(year),
        month: m,
        count: sales.length,
        data: sales,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/sku/:sku
 * Get sales for specific SKU
 * Query: ?limit=100
 */
router.get('/sku/:sku', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    
    const sales = salesService.getSalesBySku(req.params.sku, limit);
    
    res.json({
        success: true,
        sku: req.params.sku,
        count: sales.length,
        data: sales,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/metrics/:year/:month
 * Get sales metrics for month (revenue, profit, etc.)
 */
router.get('/metrics/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const metrics = salesService.calculateMetrics(parseInt(year), m);
    
    if (!metrics) {
        throw new NotFoundError('No sales data for this period');
    }
    
    res.json({
        success: true,
        year: parseInt(year),
        month: m,
        metrics,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/metrics
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&taxRate=0.20&shopLevelFees=0
 * Returns calculated metrics for arbitrary date range
 */
router.get('/metrics', asyncHandler(async (req, res) => {
    const { startDate, endDate, taxRate = 0, shopLevelFees = 0 } = req.query;

    if (!startDate || !endDate) {
        throw new ValidationError('Missing parameters', ['startDate and endDate required']);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format', ['startDate and endDate must be ISO date strings']);
    }

    const parsedTaxRate = parseFloat(taxRate) || 0;
    const parsedShopFees = parseFloat(shopLevelFees) || 0;

    const metrics = salesService.getSalesMetrics(startDate, endDate, parsedTaxRate, parsedShopFees);

    if (!metrics) {
        throw new NotFoundError('No sales data for this period');
    }

    res.json({
        success: true,
        date_range: { start: startDate, end: endDate },
        metrics,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/profitability
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns profitability grouped by SKU for date range
 */
router.get('/profitability', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        throw new ValidationError('Missing parameters', ['startDate and endDate required']);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format', ['startDate and endDate must be ISO date strings']);
    }

    const data = salesService.getProfitabilityBySku(startDate, endDate);

    res.json({
        success: true,
        date_range: { start: startDate, end: endDate },
        count: data.length,
        data,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/profit-by-sku/:year/:month
 * Get profit breakdown by SKU
 */
router.get('/profit-by-sku/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const profitBySku = salesService.getProfitBySku(parseInt(year), m);
    
    res.json({
        success: true,
        year: parseInt(year),
        month: m,
        count: profitBySku.length,
        data: profitBySku,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/top-products/:year/:month
 * Get top selling products
 * Query: ?limit=10
 */
router.get('/top-products/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const topProducts = salesService.getTopProducts(parseInt(year), m, limit);
    
    res.json({
        success: true,
        year: parseInt(year),
        month: m,
        limit,
        count: topProducts.length,
        data: topProducts,
        timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/sales/log
 * Manually log a single sale
 * Body: { "order_id": "123", "listing_id": 1, "sku": "RED-M", "product_name": "...", "quantity": 1, "sale_price": 29.99, "order_date": "2026-01-19", "material_id": "Silver" }
 */
router.post('/log', asyncHandler(async (req, res) => {
    const { order_id, listing_id, sku, product_name, quantity, sale_price, order_date, material_id, tax_included, notes } = req.body;
    
    // Validate required fields
    if (!order_id) {
        throw new ValidationError('Missing field', ['order_id is required']);
    }
    
    if (!sale_price || typeof sale_price !== 'number' || sale_price <= 0) {
        throw new ValidationError('Invalid sale_price', ['sale_price must be a positive number']);
    }
    
    const result = salesService.logSale({
        order_id,
        listing_id: listing_id || null,
        sku: sku || null,
        product_name: product_name || null,
        quantity: quantity || 1,
        sale_price,
        order_date: order_date || new Date().toISOString().split('T')[0],
        material_id,
        tax_included: tax_included || false,
        notes: notes || null
    });
    
    if (!result.success) {
        throw new Error(result.error);
    }
    
    res.status(201).json({
        success: true,
        message: 'Sale logged successfully',
        sale_id: result.sale_id,
        order_id: result.order_id,
        material_cost_locked: result.material_cost_locked_in,
        timestamp: result.timestamp
    });
}));

/**
 * GET /api/sales/by-category
 * Get fees grouped by Etsy Activity Summary categories
 * Query params: startDate, endDate (YYYY-MM-DD)
 */
router.get('/by-category', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        return res.status(400).json({
            success: false,
            error: 'startDate and endDate are required'
        });
    }
    
    // Build category totals with default values - separate fees and credits
    const categories = {
        fees: { 
            listing: 0, listingCredits: 0,
            transaction: 0, transactionCredits: 0,
            processing: 0, processingCredits: 0,
            regulatory: 0, regulatoryCredits: 0,
            vat: 0, vatCredits: 0,
            miscCredit: 0  // Etsy compensation credits (reduces net fee position)
        },
        marketing: { 
            etsy_ads: 0, etsyAdsCredits: 0,
            offsite_ads: 0, offsiteAdsCredits: 0,
            orphanCredits: []
        },
        delivery: { 
            postage: 0, postageCredits: 0
        },
        sales: 0,
        salesCredits: 0
    };
    
    try {
        // Fetch all fees within date range using is_credit flag and absolute amounts
        const allFees = db.prepare(`
            SELECT 
                fee_type,
                SUM(CASE 
                    WHEN fee_type = 'etsy_misc_credit' THEN 0
                    WHEN fee_type = 'vat_on_fees' AND amount > 0 THEN 0
                    WHEN COALESCE(is_credit, 0) = 1 THEN 0
                    WHEN description LIKE '%credit%' THEN 0
                    ELSE ABS(amount)
                END) as fees,
                SUM(CASE 
                    WHEN fee_type = 'etsy_misc_credit' THEN ABS(amount)
                    WHEN fee_type = 'vat_on_fees' AND amount > 0 THEN ABS(amount)
                    WHEN COALESCE(is_credit, 0) = 1 THEN ABS(amount)
                    WHEN description LIKE '%credit%' THEN ABS(amount)
                    ELSE 0 
                END) as credits
            FROM Etsy_Fees 
            WHERE DATE(charged_date, 'localtime') >= ? 
                AND DATE(charged_date, 'localtime') <= ?
            GROUP BY fee_type
        `).all(startDate, endDate);
        
        allFees.forEach(fee => {
            const feeAmount = fee.fees || 0;
            const creditAmount = fee.credits || 0;
            
            switch(fee.fee_type) {
                case 'listing_fee': 
                    categories.fees.listing = feeAmount;
                    categories.fees.listingCredits = creditAmount;
                    break;
                case 'transaction_fee': 
                    categories.fees.transaction = feeAmount;
                    categories.fees.transactionCredits = creditAmount;
                    break;
                case 'processing_fee': 
                    categories.fees.processing = feeAmount;
                    categories.fees.processingCredits = creditAmount;
                    break;
                case 'regulatory_fee': 
                    categories.fees.regulatory = feeAmount;
                    categories.fees.regulatoryCredits = creditAmount;
                    break;
                case 'vat_on_fees': 
                    categories.fees.vat = feeAmount;
                    categories.fees.vatCredits = creditAmount;
                    break;
                case 'etsy_ads': 
                    categories.marketing.etsy_ads = feeAmount;
                    categories.marketing.etsyAdsCredits = creditAmount;
                    break;
                case 'offsite_ads': 
                    categories.marketing.offsite_ads = feeAmount;
                    categories.marketing.offsiteAdsCredits = creditAmount;
                    break;
                case 'postage_labels': 
                    categories.delivery.postage = feeAmount;
                    categories.delivery.postageCredits = creditAmount;
                    break;
                case 'etsy_misc_credit':
                    categories.fees.miscCredit = creditAmount;
                    break;
            }
        });

        // Reallocate VAT-labelled credits that sit under other fee types (Etsy prefixes description with "VAT:")
        const vatCreditAdjustments = db.prepare(`
            SELECT fee_type, 
                   SUM(CASE WHEN COALESCE(is_credit, 0) = 1 OR amount > 0 THEN ABS(amount) ELSE 0 END) AS credit_total
            FROM Etsy_Fees
            WHERE DATE(charged_date, 'localtime') >= ?
              AND DATE(charged_date, 'localtime') <= ?
              AND description LIKE 'VAT:%'
              AND fee_type != 'vat_on_fees'
            GROUP BY fee_type
        `).all(startDate, endDate);

        vatCreditAdjustments.forEach(adj => {
            const credit = adj.credit_total || 0;
            if (!credit) return;

            // Add to VAT credits bucket
            categories.fees.vatCredits += credit;

            // Remove from the bucket it was originally counted in to avoid double counting
            switch(adj.fee_type) {
                case 'transaction_fee':
                    categories.fees.transactionCredits = Math.max(0, categories.fees.transactionCredits - credit);
                    break;
                case 'processing_fee':
                    categories.fees.processingCredits = Math.max(0, categories.fees.processingCredits - credit);
                    break;
                case 'regulatory_fee':
                    categories.fees.regulatoryCredits = Math.max(0, categories.fees.regulatoryCredits - credit);
                    break;
                case 'listing_fee':
                    categories.fees.listingCredits = Math.max(0, categories.fees.listingCredits - credit);
                    break;
            }
        });
        
        // Get sales revenue (match Etsy: ALL sales in period, including ones later refunded)
        const salesData = db.prepare(`
            SELECT 
                SUM(sale_price) as total_revenue,
                SUM(tax_amount) as total_tax
            FROM Sales 
            WHERE DATE(order_date) >= ? 
                AND DATE(order_date) <= ?
        `).get(startDate, endDate);
        
        // Get refunds that were PROCESSED (charged_date) in this period, regardless of original sale date
        // This matches Etsy's reporting where refunds appear in the month they're processed
        // Use the refund amount directly since it's the actual refund amount
        const refundsData = db.prepare(`
            SELECT 
                SUM(ABS(f.amount)) as total_refunds,
                SUM(s.tax_amount) as refund_tax
            FROM Etsy_Fees f
            INNER JOIN Sales s ON f.order_id = s.order_id
            WHERE f.fee_type = 'refund'
                AND DATE(f.charged_date, 'localtime') >= ?
                AND DATE(f.charged_date, 'localtime') <= ?
        `).get(startDate, endDate);
        
        const totalRevenue = salesData?.total_revenue || 0;
        const totalTax = salesData?.total_tax || 0;
        const totalRefunds = refundsData?.total_refunds || 0;
        const refundTax = refundsData?.refund_tax || 0;
        
        // Credits in Sales section = tax refunded (when orders are refunded, tax is credited back)
        categories.salesCredits = refundTax;
        
        // Net sales = gross sales - tax - refunds + refund tax (tax gets refunded too)
        categories.sales = totalRevenue - totalTax - totalRefunds + refundTax;
        categories.total_sales = totalRevenue;
        categories.total_refunds = totalRefunds;
        categories.total_tax = totalTax;
        categories.refund_tax = refundTax;
    } catch (error) {
        console.error('[by-category] Database error:', error);
        // Return categories with zeros if database fails
    }
    
    res.json({
        success: true,
        fees: categories.fees,
        marketing: categories.marketing,
        delivery: categories.delivery,
        sales: categories.sales,
        sales_credits: categories.salesCredits,
        total_sales: categories.total_sales,
        total_refunds: categories.total_refunds,
        total_tax: categories.total_tax,
        refund_tax: categories.refund_tax
    });
}));

/**
 * GET /api/sales/shop-level
 * Get shop-level fees (Marketing, VAT, Postage, etc.) that don't link to specific orders
 * Query params: startDate, endDate (YYYY-MM-DD)
 */
router.get('/shop-level', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        return res.status(400).json({
            success: false,
            error: 'startDate and endDate are required'
        });
    }
    
    // Get shop-level fees (order_id IS NULL) within date range
    const fees = db.prepare(`
        SELECT 
            fee_type, 
            ROUND(SUM(amount), 2) as total
        FROM Etsy_Fees 
        WHERE order_id IS NULL 
            AND charged_date >= ? 
            AND charged_date <= ?
        GROUP BY fee_type
    `).all(startDate, endDate);
    
    // Calculate total shop-level fees
    const total = fees.reduce((sum, fee) => sum + Math.abs(fee.total), 0);
    
    res.json({
        success: true,
        fees: fees,
        total: Math.round(total * 100) / 100  // Round to 2 decimals
    });
}));

/**
 * GET /api/sales/:saleId
 * Get single sale details
 */
router.get('/:saleId', asyncHandler(async (req, res) => {
    const sale = salesService.getSaleById(parseInt(req.params.saleId));
    
    if (!sale) {
        throw new NotFoundError(`Sale ${req.params.saleId} not found`);
    }
    
    res.json({
        success: true,
        data: sale,
        timestamp: new Date().toISOString()
    });
}));

/**
 * PUT /api/sales/:saleId/status
 * Update sale status
 * Body: { "status": "shipped" }
 */
router.put('/:saleId/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    
    if (!status || typeof status !== 'string') {
        throw new ValidationError('Invalid status', ['status is required and must be a string']);
    }
    
    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid status', [`status must be one of: ${validStatuses.join(', ')}`]);
    }
    
    const result = salesService.updateSaleStatus(parseInt(req.params.saleId), status);
    
    if (!result.success) {
        throw new Error(result.error);
    }
    
    res.json({
        success: true,
        message: `Sale status updated to ${status}`,
        sale_id: req.params.saleId,
        status,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/fees/stats
 * Get overall fee statistics
 */
router.get('/fees/stats', asyncHandler(async (req, res) => {
    const stats = etsyFeesService.getFeeStats();
    
    res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/fees/monthly/:year/:month
 * Get fees for specific month
 */
router.get('/fees/monthly/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    const fees = etsyFeesService.getMonthlyFees(parseInt(year), parseInt(month));
    
    res.json({
        success: true,
        data: fees,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/fees/range
 * Get fees for date range
 * Query: ?startDate=2025-01-01&endDate=2025-01-31
 */
router.get('/fees/range', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        throw new ValidationError('Missing parameters', ['startDate and endDate are required']);
    }
    
    const fees = etsyFeesService.getFeesForDateRange(startDate, endDate);
    
    res.json({
        success: true,
        startDate,
        endDate,
        data: fees,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/sales/fees/order/:orderId
 * Get fee breakdown for specific order
 */
router.get('/fees/order/:orderId', asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const breakdown = etsyFeesService.getOrderFeeBreakdown(orderId);
    const total = etsyFeesService.getOrderFees(orderId);
    
    res.json({
        success: true,
        orderId,
        totalFees: total,
        breakdown,
        timestamp: new Date().toISOString()
    });
}));

export default router;
