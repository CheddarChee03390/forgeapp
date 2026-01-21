/**
 * Supplier Costs Service
 * 
 * Manages supplier costs with historical tracking.
 * Provides cost priority: Supplier Cost → Material Cost → 0
 * 
 * @module supplierCostsService
 */

import db from './database.js';

/**
 * Get the current (active) supplier cost for a SKU
 * @param {string} sku - The SKU to lookup
 * @returns {number|null} - Current cost per unit or null if not found
 */
export function getCurrentSupplierCost(sku) {
    try {
        const stmt = db.prepare(`
            SELECT cost_per_unit 
            FROM Supplier_Costs 
            WHERE sku = ? AND is_current = 1
            ORDER BY effective_date DESC
            LIMIT 1
        `);
        
        const result = stmt.get(sku);
        return result ? result.cost_per_unit : null;
    } catch (error) {
        console.error('Error getting current supplier cost:', error);
        return null;
    }
}

/**
 * Get supplier cost that was effective at a specific date (for historical orders)
 * If no cost exists at that date, defaults to the earliest available cost
 * @param {string} sku - The SKU to lookup
 * @param {string} orderDate - The order date (YYYY-MM-DD format)
 * @returns {number|null} - Cost that was effective at that date, earliest cost, or null
 */
export function getCostForDate(sku, orderDate) {
    try {
        // Strict: only return a supplier cost if it was effective on or before the order date
        const stmt = db.prepare(`
            SELECT cost_per_unit 
            FROM Supplier_Costs 
            WHERE sku = ? AND effective_date <= ?
            ORDER BY effective_date DESC
            LIMIT 1
        `);
        const result = stmt.get(sku, orderDate);
        return result ? result.cost_per_unit : null;
    } catch (error) {
        console.error('Error getting supplier cost for date:', error);
        return null;
    }
}

/**
 * Add a new supplier cost (marks all previous costs as not current)
 * @param {string} sku - The SKU
 * @param {number} costPerUnit - Cost per unit
 * @param {string} supplierName - Supplier name (optional)
 * @param {string} effectiveDate - Effective date (optional, defaults to now)
 * @param {string} notes - Additional notes (optional)
 * @returns {Object} - {success: boolean, id: number, message: string}
 */
export function addSupplierCost(sku, costPerUnit, supplierName = null, effectiveDate = null, notes = null) {
    try {
        // Validate inputs
        if (!sku || typeof costPerUnit !== 'number' || costPerUnit < 0) {
            return { success: false, message: 'Invalid SKU or cost' };
        }

        // Start transaction
        db.prepare('BEGIN TRANSACTION').run();

        try {
            // Mark all existing costs for this SKU as not current
            const updateStmt = db.prepare(`
                UPDATE Supplier_Costs 
                SET is_current = 0 
                WHERE sku = ? AND is_current = 1
            `);
            updateStmt.run(sku);

            // Insert new cost
            const insertStmt = db.prepare(`
                INSERT INTO Supplier_Costs 
                (sku, supplier_name, cost_per_unit, effective_date, is_current, notes)
                VALUES (?, ?, ?, ?, 1, ?)
            `);

            const result = insertStmt.run(
                sku,
                supplierName,
                costPerUnit,
                effectiveDate || new Date().toISOString(),
                notes
            );

            db.prepare('COMMIT').run();

            return {
                success: true,
                id: result.lastInsertRowid,
                message: `Supplier cost added for SKU: ${sku}`
            };
        } catch (error) {
            db.prepare('ROLLBACK').run();
            throw error;
        }
    } catch (error) {
        console.error('Error adding supplier cost:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Update the current supplier cost (creates new record and marks old as not current)
 * @param {string} sku - The SKU
 * @param {number} newCostPerUnit - New cost per unit
 * @param {string} supplierName - Supplier name (optional)
 * @param {string} notes - Additional notes (optional)
 * @returns {Object} - {success: boolean, message: string}
 */
export function updateSupplierCost(sku, newCostPerUnit, supplierName = null, notes = null) {
    return addSupplierCost(sku, newCostPerUnit, supplierName, new Date().toISOString(), notes);
}

/**
 * Get the complete cost history for a SKU
 * @param {string} sku - The SKU to lookup
 * @returns {Array} - Array of cost records sorted by effective_date DESC
 */
export function getSupplierCostHistory(sku) {
    try {
        const stmt = db.prepare(`
            SELECT 
                id,
                sku,
                supplier_name,
                cost_per_unit,
                effective_date,
                is_current,
                notes,
                created_at
            FROM Supplier_Costs
            WHERE sku = ?
            ORDER BY effective_date DESC
        `);
        
        return stmt.all(sku);
    } catch (error) {
        console.error('Error getting supplier cost history:', error);
        return [];
    }
}

/**
 * Get current supplier cost with details
 * @param {string} sku - The SKU to lookup
 * @returns {Object|null} - Full cost record or null
 */
export function getCurrentSupplierCostDetails(sku) {
    try {
        const stmt = db.prepare(`
            SELECT 
                id,
                sku,
                supplier_name,
                cost_per_unit,
                effective_date,
                notes,
                created_at
            FROM Supplier_Costs 
            WHERE sku = ? AND is_current = 1
            ORDER BY effective_date DESC
            LIMIT 1
        `);
        
        return stmt.get(sku);
    } catch (error) {
        console.error('Error getting current supplier cost details:', error);
        return null;
    }
}

/**
 * Delete a supplier cost record (soft delete by marking as not current)
 * @param {number} id - The cost record ID
 * @returns {Object} - {success: boolean, message: string}
 */
export function deleteSupplierCost(id) {
    try {
        const stmt = db.prepare(`
            UPDATE Supplier_Costs 
            SET is_current = 0 
            WHERE id = ?
        `);
        
        const result = stmt.run(id);
        
        return {
            success: result.changes > 0,
            message: result.changes > 0 ? 'Cost record deactivated' : 'Cost record not found'
        };
    } catch (error) {
        console.error('Error deleting supplier cost:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get all SKUs that have supplier costs
 * @returns {Array} - Array of SKUs with their current costs
 */
export function getAllSupplierCosts() {
    try {
        const stmt = db.prepare(`
            SELECT 
                sku,
                supplier_name,
                cost_per_unit,
                effective_date
            FROM Supplier_Costs
            WHERE is_current = 1
            ORDER BY sku
        `);
        
        return stmt.all();
    } catch (error) {
        console.error('Error getting all supplier costs:', error);
        return [];
    }
}

/**
 * Get cost statistics
 * @returns {Object} - Statistics about supplier costs
 */
export function getSupplierCostStats() {
    try {
        const stats = db.prepare(`
            SELECT 
                COUNT(DISTINCT sku) as total_skus_with_costs,
                COUNT(*) as total_cost_records,
                AVG(cost_per_unit) as average_cost,
                MIN(cost_per_unit) as min_cost,
                MAX(cost_per_unit) as max_cost
            FROM Supplier_Costs
            WHERE is_current = 1
        `).get();
        
        return stats;
    } catch (error) {
        console.error('Error getting supplier cost stats:', error);
        return null;
    }
}

/**
 * Bulk import supplier costs from array
 * @param {Array} costs - Array of {sku, cost_per_unit, supplier_name, notes}
 * @returns {Object} - {success: boolean, imported: number, errors: Array}
 */
export function bulkImportSupplierCosts(costs) {
    const results = { success: true, imported: 0, errors: [] };
    
    for (const cost of costs) {
        try {
            const result = addSupplierCost(
                cost.sku,
                cost.cost_per_unit,
                cost.supplier_name || null,
                cost.effective_date || null,
                cost.notes || null
            );
            
            if (result.success) {
                results.imported++;
            } else {
                results.errors.push({ sku: cost.sku, error: result.message });
            }
        } catch (error) {
            results.errors.push({ sku: cost.sku, error: error.message });
        }
    }
    
    return results;
}

export default {
    getCurrentSupplierCost,
    getCostForDate,
    addSupplierCost,
    updateSupplierCost,
    getSupplierCostHistory,
    getCurrentSupplierCostDetails,
    deleteSupplierCost,
    getAllSupplierCosts,
    getSupplierCostStats,
    bulkImportSupplierCosts
};
