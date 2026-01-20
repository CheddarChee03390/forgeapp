// Reports API Routes - Tax calculations and analytics
import express from 'express';
import taxReportService from '../services/taxReportService.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/reports/monthly/:year/:month
 * Get monthly tax report
 * Query: ?taxRate=0.25 (default 25%)
 */
router.get('/monthly/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    const taxRate = Math.min(Math.max(parseFloat(req.query.taxRate) || 0.25, 0), 1);
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const report = taxReportService.calculateMonthlyTax(parseInt(year), m, taxRate);
    
    if (!report.success) {
        throw new NotFoundError(report.error);
    }
    
    res.json({
        success: true,
        ...report,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/quarterly/:year/:quarter
 * Get quarterly tax estimate
 * Query: ?taxRate=0.25 (default 25%)
 */
router.get('/quarterly/:year/:quarter', asyncHandler(async (req, res) => {
    const { year, quarter } = req.params;
    const taxRate = Math.min(Math.max(parseFloat(req.query.taxRate) || 0.25, 0), 1);
    
    const q = parseInt(quarter);
    if (q < 1 || q > 4) {
        throw new ValidationError('Invalid quarter', ['quarter must be between 1 and 4']);
    }
    
    const report = taxReportService.calculateQuarterlyTax(parseInt(year), q, taxRate);
    
    if (!report.success) {
        throw new NotFoundError(report.error);
    }
    
    res.json({
        success: true,
        ...report,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/yearly/:year
 * Get yearly tax summary
 * Query: ?taxRate=0.25 (default 25%)
 */
router.get('/yearly/:year', asyncHandler(async (req, res) => {
    const { year } = req.params;
    const taxRate = Math.min(Math.max(parseFloat(req.query.taxRate) || 0.25, 0), 1);
    
    const report = taxReportService.calculateYearlyTax(parseInt(year), taxRate);
    
    if (!report.success) {
        throw new NotFoundError(report.error);
    }
    
    res.json({
        success: true,
        ...report,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/tax-schedule/:year
 * Get tax payment schedule for year
 */
router.get('/tax-schedule/:year', asyncHandler(async (req, res) => {
    const { year } = req.params;
    
    const schedule = taxReportService.getTaxPaymentSchedule(parseInt(year));
    
    if (!schedule.success) {
        throw new Error(schedule.error);
    }
    
    res.json({
        success: true,
        ...schedule,
        timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/reports/fees/log
 * Log a fee (transaction fee, listing fee, etc.)
 * Body: { "order_id": "123", "fee_type": "transaction", "amount": 2.50, "description": "Etsy transaction fee" }
 */
router.post('/fees/log', asyncHandler(async (req, res) => {
    const { order_id, fee_type, amount, description } = req.body;
    
    if (!fee_type || typeof fee_type !== 'string') {
        throw new ValidationError('Missing field', ['fee_type is required']);
    }
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new ValidationError('Invalid amount', ['amount must be a positive number']);
    }
    
    const validFeeTypes = ['transaction', 'payment_processing', 'listing', 'shop', 'shipping', 'other'];
    if (!validFeeTypes.includes(fee_type)) {
        throw new ValidationError('Invalid fee_type', [`fee_type must be one of: ${validFeeTypes.join(', ')}`]);
    }
    
    const result = taxReportService.logFee(order_id, fee_type, amount, description);
    
    if (!result.success) {
        throw new Error(result.error);
    }
    
    res.status(201).json({
        success: true,
        message: 'Fee logged successfully',
        fee_id: result.fee_id,
        amount: result.amount,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/fees/summary/:year/:month
 * Get fees summary for month
 */
router.get('/fees/summary/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const summary = taxReportService.getFeesSummary(parseInt(year), m);
    
    res.json({
        success: true,
        year: parseInt(year),
        month: m,
        count: summary.length,
        data: summary,
        total_fees: summary.reduce((sum, f) => sum + (f.total || 0), 0),
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/fees/annual/:year
 * Get fees summary for entire year
 */
router.get('/fees/annual/:year', asyncHandler(async (req, res) => {
    const { year } = req.params;
    
    const summary = taxReportService.getFeesSummary(parseInt(year));
    
    res.json({
        success: true,
        year: parseInt(year),
        count: summary.length,
        data: summary,
        total_fees: summary.reduce((sum, f) => sum + (f.total || 0), 0),
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/cached/:year/:month
 * Get cached monthly report (if available)
 */
router.get('/cached/:year/:month', asyncHandler(async (req, res) => {
    const { year, month } = req.params;
    
    const m = parseInt(month);
    if (m < 1 || m > 12) {
        throw new ValidationError('Invalid month', ['month must be between 1 and 12']);
    }
    
    const cached = taxReportService.getCachedReport(parseInt(year), m);
    
    if (!cached) {
        throw new NotFoundError(`No cached report for ${year}-${month}`);
    }
    
    res.json({
        success: true,
        data: cached,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/reports/summary
 * Get summary of all reports (quick overview)
 */
router.get('/summary', asyncHandler(async (req, res) => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    const currentMonth = taxReportService.calculateMonthlyTax(year, month);
    const currentQuarter = Math.ceil(month / 3);
    const currentQ = taxReportService.calculateQuarterlyTax(year, currentQuarter);
    const yearlyData = taxReportService.calculateYearlyTax(year);
    
    res.json({
        success: true,
        current_month: {
            year,
            month,
            ...currentMonth
        },
        current_quarter: {
            year,
            quarter: currentQuarter,
            ...currentQ
        },
        year_to_date: yearlyData,
        timestamp: new Date().toISOString()
    });
}));

export default router;
