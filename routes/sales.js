// Sales API Routes - Order and transaction tracking
import express from 'express';
import salesService from '../services/salesService.js';
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

export default router;
