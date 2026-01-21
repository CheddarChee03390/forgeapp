// Etsy Statement CSV Import Routes
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { Readable } from 'stream';
import csv from 'csv-parser';
import db from '../services/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { normalizeDate } from '../utils/csv-helpers.js';
import { processFeeRow, insertFeeRow, getMonthCounts, getFeatureTypeCounts } from '../services/etsyFeeProcessor.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const IMPORT_SOURCE = 'etsy_statement';

const getLock = db.prepare(`
    SELECT month, locked_at, locked_by, note
    FROM Import_Locks
    WHERE source = ? AND month = ?
`);

const insertLock = db.prepare(`
    INSERT OR REPLACE INTO Import_Locks (source, month, locked_by, note)
    VALUES (?, ?, ?, ?)
`);

const deleteLock = db.prepare(`
    DELETE FROM Import_Locks
    WHERE source = ? AND month = ?
`);

function assertMonthUnlocked(month) {
    const lock = getLock.get(IMPORT_SOURCE, month);
    if (lock) {
        const lockInfo = `${lock.month} (locked by ${lock.locked_by || 'system'} at ${lock.locked_at})`;
        const error = new Error(`Month ${lockInfo} is locked. Unlock to re-import.`);
        error.statusCode = 400;
        error.isLocked = true;
        throw error;
    }
}

function lockMonth(month, lockedBy = 'system', note = null) {
    insertLock.run(IMPORT_SOURCE, month, lockedBy, note);
}

function unlockMonth(month) {
    const result = deleteLock.run(IMPORT_SOURCE, month);
    return result.changes > 0;
}

/**
 * POST /api/import/etsy-statement/simulate
 * Simulate Etsy statement CSV import (fees, refunds, postage)
 */
router.post('/simulate', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const rows = [];

    try {
        // Parse CSV
        await new Promise((resolve, reject) => {
            Readable.from([req.file.buffer])
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'CSV file is empty' });
        }

        // Get month distribution and fee type counts
        const { monthCounts, monthData } = getMonthCounts(rows);
        const feeTypeCounts = getFeatureTypeCounts(rows, db);
        const months = Object.keys(monthCounts).sort();
        const detectedMonth = months[0] || null;

        res.json({
            success: true,
            simulation: {
                totalRows: rows.length,
                wouldImport: Object.keys(feeTypeCounts).length,
                monthDetected: detectedMonth,
                monthCounts,
                feeTypeCounts,
                sampleRows: rows.slice(0, 5)
            }
        });
    } catch (error) {
        console.error('❌ Etsy statement simulation error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
}));

/**
 * POST /api/import/etsy-statement/execute
 * Execute Etsy statement CSV import with hash-based deduplication
 * Body: { month: "2025-11" } (optional, will auto-detect if not provided)
 */
router.post('/execute', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const providedMonth = req.body?.month;
    
    const rows = [];

    try {
        // Parse CSV
        await new Promise((resolve, reject) => {
            Readable.from([req.file.buffer])
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        // Auto-detect month
        const { monthCounts, monthData } = getMonthCounts(rows);
        const months = Object.keys(monthCounts).sort();
        
        if (months.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid dates found in CSV.' });
        }
        
        const selectedMonth = providedMonth || months[0];

        try {
            assertMonthUnlocked(selectedMonth);
        } catch (lockError) {
            return res.status(lockError.statusCode || 400).json({
                success: false,
                error: lockError.message,
                monthLocked: true,
                statementMonth: selectedMonth
            });
        }
        
        // Check if already imported
        const [year, monthNum] = selectedMonth.split('-');
        const nextMonth = (parseInt(monthNum) + 1).toString().padStart(2, '0');
        const nextYear = parseInt(monthNum) === 12 ? (parseInt(year) + 1).toString() : year;
        const startDate = `${year}-${monthNum}-01`;
        const endDate = `${nextYear}-${nextMonth}-01`;
        
        const existing = db.prepare('SELECT COUNT(*) as count FROM Etsy_Fees WHERE charged_date >= ? AND charged_date < ?')
            .get(startDate, endDate);
            
        if (existing.count > 0) {
            return res.status(400).json({
                success: false,
                error: `Statement for ${selectedMonth} already imported (${existing.count} fees found).`,
                monthExists: true,
                existingCount: existing.count
            });
        }

        // Process rows
        let imported = 0;
        const errors = [];

        const doInserts = db.transaction(() => {
            rows.forEach((row, idx) => {
                try {
                    // Use centralized processor
                    const feeData = processFeeRow(row, db);
                    if (!feeData) return;  // Skip invalid rows
                    
                    // Filter by selected month
                    const rowMonth = feeData.isoDate.substring(0, 7);
                    if (rowMonth !== selectedMonth) return;
                    
                    // Insert the fee
                    if (insertFeeRow(db, feeData) > 0) {
                        imported++;
                    }
                } catch (error) {
                    errors.push(`Row ${idx + 1}: ${error.message}`);
                }
            });
        });
        
        doInserts();

        if (imported > 0) {
            lockMonth(selectedMonth, 'import');
        }

        res.json({
            success: true,
            imported,
            statementMonth: selectedMonth,
            message: `Imported ${imported} fees for ${selectedMonth}`,
            monthCounts,
            errors: errors.length > 0 ? errors.slice(0, 20) : undefined
        });
        
    } catch (error) {
        console.error('❌ Etsy statement import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

/**
 * POST /api/import/etsy-statement/bulk-execute
 * Bulk import all months in CSV
 */
router.post('/bulk-execute', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const rows = [];

    try {
        // Parse CSV
        await new Promise((resolve, reject) => {
            Readable.from([req.file.buffer])
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'CSV file is empty' });
        }

        // Group rows by month
        const { monthCounts, monthData } = getMonthCounts(rows);
        const monthRows = {};
        
        rows.forEach(row => {
            const processed = processFeeRow(row, db);
            if (!processed) return;
            
            const month = processed.isoDate.substring(0, 7);
            if (!monthRows[month]) monthRows[month] = [];
            monthRows[month].push({ ...row, _isoDate: processed.isoDate });
        });

        const months = Object.keys(monthRows).sort();
        const results = [];

        // Process each month
        for (const month of months) {
            console.log(`📅 Processing month: ${month}`);
            const locked = getLock.get(IMPORT_SOURCE, month);
            if (locked) {
                results.push({
                    month,
                    status: 'skipped',
                    reason: `Month locked by ${locked.locked_by || 'system'}`,
                    imported: 0
                });
                continue;
            }
            
            // Check if already imported
            const [year, monthNum] = month.split('-');
            const nextMonth = (parseInt(monthNum) + 1).toString().padStart(2, '0');
            const nextYear = parseInt(monthNum) === 12 ? (parseInt(year) + 1).toString() : year;
            const startDate = `${year}-${monthNum}-01`;
            const endDate = `${nextYear}-${nextMonth}-01`;
            
            const existing = db.prepare('SELECT COUNT(*) as count FROM Etsy_Fees WHERE charged_date >= ? AND charged_date < ?')
                .get(startDate, endDate);
                
            if (existing.count > 0) {
                results.push({
                    month,
                    status: 'skipped',
                    reason: `Already imported (${existing.count} fees)`,
                    imported: 0
                });
                continue;
            }

            let imported = 0;

            const doInserts = db.transaction(() => {
                monthRows[month].forEach((row) => {
                    try {
                        const feeData = processFeeRow(row, db);
                        if (!feeData) return;
                        
                        if (insertFeeRow(db, feeData) > 0) {
                            imported++;
                        }
                    } catch (error) {
                        console.error(`❌ Error processing row in ${month}:`, error.message);
                    }
                });
            });

            doInserts();

            results.push({
                month,
                status: 'success',
                imported
            });

            if (imported > 0) {
                lockMonth(month, 'import');
            }

            console.log(`✅ Month ${month}: Imported ${imported}`);
        }

        // Summary
        const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);
        const skippedMonths = results.filter(r => r.status === 'skipped').length;

        res.json({
            success: true,
            bulkResults: results,
            summary: {
                monthsProcessed: months.length,
                monthsSkipped: skippedMonths,
                totalImported,
                message: `Processed ${months.length} months: Imported ${totalImported} total fees`
            }
        });

    } catch (error) {
        console.error('❌ Bulk import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

/**
 * POST /api/import/etsy-statement/manual-entry
 * Manually enter shop-level fees (ads, listing fees, etc.)
 */
router.post('/manual-entry', asyncHandler(async (req, res) => {
    const { month, fees } = req.body;
    
    if (!month || !fees || !Array.isArray(fees)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Required: month (YYYY-MM) and fees array' 
        });
    }
    
    let inserted = 0;
    const errors = [];
    
    try {
        const doInserts = db.transaction(() => {
            fees.forEach((fee, idx) => {
                if (!fee.fee_type || !fee.amount) {
                    errors.push(`Fee ${idx + 1}: Missing fee_type or amount`);
                    return;
                }
                
                const chargedDate = `${month}-01`;
                const feeHash = crypto.createHash('sha256')
                    .update(`${month}|MANUAL|${fee.fee_type}|${fee.amount}|${fee.description || ''}`)
                    .digest('hex');
                
                try {
                    const result = db.prepare(`
                        INSERT OR IGNORE INTO Etsy_Fees (order_id, fee_type, amount, description, charged_date, fee_hash, is_credit)
                        VALUES (NULL, ?, ?, ?, ?, ?, 0)
                    `).run(
                        fee.fee_type,
                        Math.abs(parseFloat(fee.amount)),
                        fee.description || `${fee.fee_type} - ${month}`,
                        chargedDate,
                        feeHash
                    );
                    
                    if (result.changes > 0) {
                        inserted++;
                    }
                } catch (insertError) {
                    errors.push(`Fee ${idx + 1}: ${insertError.message}`);
                }
            });
        });
        
        doInserts();
        
        res.json({
            success: true,
            inserted,
            message: `Manually entered ${inserted} shop-level fees for ${month}`,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('❌ Manual entry error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

/**
 * POST /api/import/etsy-statement/lock
 * Manually lock a month to prevent re-imports
 */
router.post('/lock', asyncHandler(async (req, res) => {
    const { month, note } = req.body;
    if (!month) {
        return res.status(400).json({ success: false, error: 'Month (YYYY-MM) is required' });
    }

    lockMonth(month, 'manual', note || null);

    res.json({ success: true, locked: true, month, note: note || null });
}));

/**
 * POST /api/import/etsy-statement/unlock
 * Unlock a month to allow re-imports
 */
router.post('/unlock', asyncHandler(async (req, res) => {
    const { month } = req.body;
    if (!month) {
        return res.status(400).json({ success: false, error: 'Month (YYYY-MM) is required' });
    }

    const removed = unlockMonth(month);
    if (!removed) {
        return res.status(404).json({ success: false, error: `No lock found for ${month}` });
    }

    res.json({ success: true, unlocked: true, month });
}));

/**
 * GET /api/import/etsy-statement/locks
 * List locked months for Etsy statements
 */
router.get('/locks', asyncHandler(async (_req, res) => {
    const rows = db.prepare(`
        SELECT month, locked_at, locked_by, note
        FROM Import_Locks
        WHERE source = ?
        ORDER BY month DESC
    `).all(IMPORT_SOURCE);

    res.json({ success: true, locks: rows });
}));

export default router;
