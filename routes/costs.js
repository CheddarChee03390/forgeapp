// Costs API Routes - Material cost history tracking
import express from 'express';
import costHistoryService from '../services/costHistoryService.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/costs/current
 * Get all current material costs (snapshot)
 */
router.get('/current', asyncHandler(async (req, res) => {
    const costs = costHistoryService.getAllCurrentCosts();
    res.json({
        success: true,
        count: costs.length,
        data: costs,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/costs/:materialId/current
 * Get current cost for specific material
 */
router.get('/:materialId/current', asyncHandler(async (req, res) => {
    const cost = costHistoryService.getCurrentCost(req.params.materialId);
    
    if (!cost) {
        throw new NotFoundError(`No cost history found for material ${req.params.materialId}`);
    }
    
    res.json({
        success: true,
        material_id: req.params.materialId,
        cost: cost.cost,
        effective_date: cost.effective_date,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/costs/:materialId/history
 * Get full cost history for material
 */
router.get('/:materialId/history', asyncHandler(async (req, res) => {
    const history = costHistoryService.getCostHistory(req.params.materialId);
    
    if (history.length === 0) {
        throw new NotFoundError(`No cost history found for material ${req.params.materialId}`);
    }
    
    res.json({
        success: true,
        material_id: req.params.materialId,
        count: history.length,
        history,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/costs/:materialId/trend
 * Get cost trend (change over time)
 * Query: ?days=30 (default 30)
 */
router.get('/:materialId/trend', asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    
    if (days < 1 || days > 365) {
        throw new ValidationError('Invalid days parameter', ['days must be between 1 and 365']);
    }
    
    const trend = costHistoryService.getCostChange(req.params.materialId, days);
    
    if (!trend || trend.change_percentage === undefined) {
        throw new NotFoundError(`Unable to calculate trend for material ${req.params.materialId}`);
    }
    
    res.json({
        success: true,
        material_id: req.params.materialId,
        period_days: days,
        ...trend,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/costs/:materialId/changes
 * Get cost changes in date range
 * Query: ?startDate=2025-01-01&endDate=2025-01-31
 */
router.get('/:materialId/changes', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        throw new ValidationError('Missing parameters', ['startDate and endDate required']);
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}/.test(startDate) || !/^\d{4}-\d{2}-\d{2}/.test(endDate)) {
        throw new ValidationError('Invalid date format', ['Use YYYY-MM-DD format']);
    }
    
    const changes = costHistoryService.getCostChanges(req.params.materialId, startDate, endDate);
    
    res.json({
        success: true,
        material_id: req.params.materialId,
        date_range: { start: startDate, end: endDate },
        count: changes.length,
        changes,
        timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/costs/:materialId/update
 * Update material cost (creates new history entry)
 * Body: { "newCost": 5.50, "reason": "Supplier price increase" }
 */
router.post('/:materialId/update', asyncHandler(async (req, res) => {
    const { newCost, reason } = req.body;
    
    // Validate input
    if (newCost === undefined || newCost === null) {
        throw new ValidationError('Invalid cost', ['newCost is required']);
    }
    
    if (typeof newCost !== 'number' || newCost < 0) {
        throw new ValidationError('Invalid cost', ['newCost must be a positive number']);
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        throw new ValidationError('Invalid reason', ['reason is required and must not be empty']);
    }
    
    const result = costHistoryService.updateMaterialCost(
        req.params.materialId,
        newCost,
        reason.trim()
    );
    
    if (!result.success) {
        throw new Error(result.error);
    }
    
    res.status(200).json({
        success: true,
        message: 'Cost updated successfully',
        material_id: result.materialId,
        new_cost: result.newCost,
        reason: result.reason,
        timestamp: result.timestamp
    });
}));

/**
 * POST /api/costs/bulk-update
 * Update multiple material costs
 * Body: { "updates": [ { "materialId": "id", "newCost": 5.50, "reason": "..." }, ... ] }
 */
router.post('/bulk-update', asyncHandler(async (req, res) => {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError('Invalid updates', ['updates must be a non-empty array']);
    }
    
    // Validate each update
    for (const update of updates) {
        if (!update.materialId || update.newCost === undefined || !update.reason) {
            throw new ValidationError('Invalid update entry', [
                'Each update needs materialId, newCost, and reason'
            ]);
        }
        
        if (typeof update.newCost !== 'number' || update.newCost < 0) {
            throw new ValidationError('Invalid cost', ['newCost must be a positive number']);
        }
    }
    
    const result = costHistoryService.bulkUpdateCosts(updates);
    
    if (!result.success) {
        throw new Error(result.error);
    }
    
    res.status(200).json({
        success: true,
        message: `Updated ${result.updated} materials`,
        updated_count: result.updated,
        timestamp: result.timestamp
    });
}));

/**
 * GET /api/costs/:materialId/average
 * Get average cost for date range
 * Query: ?startDate=2025-01-01&endDate=2025-01-31
 */
router.get('/:materialId/average', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        throw new ValidationError('Missing parameters', ['startDate and endDate required']);
    }
    
    const average = costHistoryService.getAverageCost(req.params.materialId, startDate, endDate);
    
    res.json({
        success: true,
        material_id: req.params.materialId,
        date_range: { start: startDate, end: endDate },
        average_cost: parseFloat(average.toFixed(2)),
        timestamp: new Date().toISOString()
    });
}));

export default router;
