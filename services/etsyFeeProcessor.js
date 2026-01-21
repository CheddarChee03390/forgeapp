// Etsy Fee Processing Service - Centralized logic for fee/credit handling
import { normalizeDate, generateHash, mapFeeType, extractOrderId } from '../utils/csv-helpers.js';

/**
 * Clean BOM and encoding artifacts from raw amount string
 * Handles: UTF-8 BOM (\u00A0), Windows encoding (Â, \xA0)
 */
function cleanAmount(rawAmount) {
    return (rawAmount || '')
        .replace(/[\u00A0\u00C2\xA0]/g, '')  // Remove BOM, Â, non-breaking space
        .replace(/[^0-9.-]/g, '');            // Keep only digits, minus, decimal
}

/**
 * Detect if a fee is a credit based on type/title
 * Credits can have negative amounts in CSV (which we normalize to positive)
 */
function isCredit(type, title) {
    const lowerType = (type || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    return lowerType === 'credit' || lowerTitle.includes('credit');
}

/**
 * Process a single CSV row into normalized fee data
 * Returns: { amount, isCredit, feeType, isoDate, fullOrderId, feeHash, description }
 * Returns null if row should be skipped
 */
export function processFeeRow(row, db) {
    const type = (row.Type || '').trim();
    const title = (row.Title || '').trim();
    const info = (row.Info || '').trim();
    
    // Find date field (flexible column name detection)
    const dateKey = Object.keys(row).find(k => {
        const lower = k.toLowerCase();
        return lower.includes('date') || lower === 'date';
    });
    const rawDate = dateKey ? (row[dateKey] || '').toString().trim() : '';
    
    // Skip info-only rows (deposits, sales records, etc.)
    if (!type || !title || 
        type.toLowerCase() === 'sale' || 
        type.toLowerCase() === 'deposit') {
        return null;
    }
    
    // Parse and clean amount
    let amountStr = row.Amount || '';
    if (amountStr === '--' || !amountStr) {
        amountStr = row['Fees & Taxes'] || row['Fees & taxes'] || '0';
    }
    
    const cleanedAmount = cleanAmount(amountStr);
    let amount = parseFloat(cleanedAmount) || 0;
    
    // Skip zero amounts
    if (amount === 0) return null;
    
    // Normalize dates
    const isoDate = normalizeDate(rawDate);
    if (!isoDate || isoDate === '1970-01-01') return null;
    
    // Check if this is a credit
    const creditFlag = isCredit(type, title);
    if (creditFlag && amount < 0) {
        amount = Math.abs(amount);  // Normalize credits to positive
    }
    
    // Special handling for refunds
    if (type.toLowerCase() === 'refund') {
        const orderNumMatch = title.match(/#(\d+)/);
        if (!orderNumMatch) return null;
        
        const etsyOrderNum = orderNumMatch[1];
        const orderRecord = db.prepare('SELECT order_id FROM Sales WHERE etsy_order_number = ? LIMIT 1')
            .get(etsyOrderNum);
        
        if (!orderRecord) return null;
        
        // Mark sale as refunded
        db.prepare('UPDATE Sales SET status = ?, material_cost_at_sale = 0 WHERE order_id = ?')
            .run('refunded', orderRecord.order_id);
        
        const feesAndTaxes = (row['Fees & Taxes'] || row['Fees & taxes'] || '').toString().trim();
        const net = (row.Net || '').toString().trim();
        const feeHash = generateHash(rawDate, type, title, feesAndTaxes, net, info);
        
        return {
            amount,
            isCredit: false,
            feeType: 'refund',
            isoDate,
            fullOrderId: orderRecord.order_id,
            feeHash,
            description: title,
            isRefund: true
        };
    }
    
    // Map to fee type
    const feeType = mapFeeType(type, title);
    if (!feeType) return null;
    
    // Find order ID if it exists
    const etsyOrderNum = extractOrderId(title, info);
    let fullOrderId = null;
    if (etsyOrderNum) {
        const orderRecord = db.prepare('SELECT order_id FROM Sales WHERE etsy_order_number = ? LIMIT 1')
            .get(etsyOrderNum);
        if (orderRecord) {
            fullOrderId = orderRecord.order_id;
        }
    }
    
    // Generate dedup hash
    const feesAndTaxes = (row['Fees & Taxes'] || row['Fees & taxes'] || '').toString().trim();
    const net = (row.Net || '').toString().trim();
    const feeHash = generateHash(rawDate, type, title, feesAndTaxes, net, info);
    
    return {
        amount,
        isCredit: creditFlag,
        feeType,
        isoDate,
        fullOrderId,
        feeHash,
        description: title
    };
}

/**
 * Insert processed fee row into database
 * Returns: number of rows inserted (0 or 1)
 */
export function insertFeeRow(db, feeData) {
    const result = db.prepare(`
        INSERT INTO Etsy_Fees (order_id, fee_type, amount, description, charged_date, fee_hash, is_credit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        feeData.fullOrderId,
        feeData.feeType,
        feeData.amount,
        feeData.description,
        feeData.isoDate,
        feeData.feeHash,
        feeData.isCredit ? 1 : 0
    );
    
    return result.changes || 0;
}

/**
 * Count detected month distribution in rows
 * Useful for validation and user feedback
 */
export function getMonthCounts(rows) {
    const monthCounts = {};
    const monthData = {};
    
    rows.forEach(row => {
        const dateKey = Object.keys(row).find(k => {
            const lower = k.toLowerCase();
            return lower.includes('date') || lower === 'date';
        });
        const rawDate = dateKey ? (row[dateKey] || '').toString().trim() : '';
        
        if (rawDate) {
            const isoDate = normalizeDate(rawDate);
            if (isoDate && isoDate !== '1970-01-01') {
                const month = isoDate.substring(0, 7);
                monthCounts[month] = (monthCounts[month] || 0) + 1;
                if (!monthData[month]) monthData[month] = isoDate;
            }
        }
    });
    
    return { monthCounts, monthData };
}

/**
 * Get fee type distribution from rows
 * Used for import preview/simulation
 */
export function getFeatureTypeCounts(rows, db) {
    const typeCounts = {};
    
    rows.forEach(row => {
        const processed = processFeeRow(row, db);
        if (processed) {
            typeCounts[processed.feeType] = (typeCounts[processed.feeType] || 0) + 1;
        }
    });
    
    return typeCounts;
}
