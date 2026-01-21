/**
 * Supplier Costs Routes
 * API endpoints for managing supplier costs
 */

import express from 'express';
import supplierCostsService from '../services/supplierCostsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/costs/supplier
 * Get all current supplier costs
 */
router.get('/', asyncHandler(async (req, res) => {
    const costs = supplierCostsService.getAllSupplierCosts();
    res.json(costs);
}));

/**
 * GET /api/costs/supplier/stats
 * Get supplier cost statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = supplierCostsService.getSupplierCostStats();
    res.json(stats);
}));

/**
 * GET /api/costs/supplier/:sku
 * Get current supplier cost for a specific SKU
 */
router.get('/:sku', asyncHandler(async (req, res) => {
    const { sku } = req.params;
    const costDetails = supplierCostsService.getCurrentSupplierCostDetails(sku);
    
    if (!costDetails) {
        return res.status(404).json({
            success: false,
            message: `No supplier cost found for SKU: ${sku}`
        });
    }
    
    res.json({ success: true, cost: costDetails });
}));

/**
 * GET /api/costs/supplier/:sku/history
 * Get cost history for a specific SKU
 */
router.get('/:sku/history', asyncHandler(async (req, res) => {
    const { sku } = req.params;
    const history = supplierCostsService.getSupplierCostHistory(sku);
    
    res.json(history);
}));

/**
 * POST /api/costs/supplier
 * Add a new supplier cost
 * Body: { sku, cost_per_unit, supplier_name?, effective_date?, notes? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { sku, cost_per_unit, supplier_name, effective_date, notes } = req.body;
    
    if (!sku || cost_per_unit === undefined) {
        return res.status(400).json({
            success: false,
            message: 'SKU and cost_per_unit are required'
        });
    }
    
    const result = supplierCostsService.addSupplierCost(
        sku,
        parseFloat(cost_per_unit),
        supplier_name || null,
        effective_date || null,
        notes || null
    );
    
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(400).json(result);
    }
}));

/**
 * PUT /api/costs/supplier/:sku
 * Update supplier cost for a SKU (creates new historical record)
 * Body: { cost_per_unit, supplier_name?, notes? }
 */
router.put('/:sku', asyncHandler(async (req, res) => {
    const { sku } = req.params;
    const { cost_per_unit, supplier_name, notes } = req.body;
    
    if (cost_per_unit === undefined) {
        return res.status(400).json({
            success: false,
            message: 'cost_per_unit is required'
        });
    }
    
    const result = supplierCostsService.updateSupplierCost(
        sku,
        parseFloat(cost_per_unit),
        supplier_name || null,
        notes || null
    );
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
}));

/**
 * POST /api/costs/supplier/bulk
 * Bulk import supplier costs
 * Body: { costs: [{ sku, cost_per_unit, supplier_name?, notes? }] }
 */
router.post('/bulk', asyncHandler(async (req, res) => {
    const { costs } = req.body;
    
    if (!Array.isArray(costs) || costs.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'costs array is required'
        });
    }
    
    const result = supplierCostsService.bulkImportSupplierCosts(costs);
    
    res.json(result);
}));

/**
 * DELETE /api/costs/supplier/:id
 * Deactivate a supplier cost record
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = supplierCostsService.deleteSupplierCost(parseInt(id));
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(404).json(result);
    }
}));

export default router;
