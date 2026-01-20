// Cost History Service - Manages material costs and historical tracking
import db from './database.js';

class CostHistoryService {
    /**
     * Get current cost for a material
     */
    getCurrentCost(materialId) {
        try {
            const stmt = db.prepare(`
                SELECT cost, effective_date 
                FROM Material_Costs 
                WHERE material_id = ? AND is_current = 1
                LIMIT 1
            `);
            return stmt.get(materialId);
        } catch (error) {
            console.error(`❌ Error getting current cost for ${materialId}:`, error);
            return null;
        }
    }

    /**
     * Get cost at specific date (for historical lookups)
     */
    getCostAtDate(materialId, date) {
        try {
            const stmt = db.prepare(`
                SELECT cost, effective_date 
                FROM Material_Costs 
                WHERE material_id = ? 
                AND effective_date <= ?
                ORDER BY effective_date DESC
                LIMIT 1
            `);
            return stmt.get(materialId, date);
        } catch (error) {
            console.error(`❌ Error getting cost at date for ${materialId}:`, error);
            return null;
        }
    }

    /**
     * Update material cost and log change
     */
    updateMaterialCost(materialId, newCost, reason = 'Price update') {
        try {
            const transaction = db.transaction(() => {
                // Deactivate current cost
                const deactivate = db.prepare(`
                    UPDATE Material_Costs 
                    SET is_current = 0 
                    WHERE material_id = ? AND is_current = 1
                `);
                deactivate.run(materialId);

                // Insert new cost as current
                const insert = db.prepare(`
                    INSERT INTO Material_Costs 
                    (material_id, cost, effective_date, is_current, changed_reason)
                    VALUES (?, ?, datetime('now'), 1, ?)
                `);
                insert.run(materialId, newCost, reason);

                return {
                    success: true,
                    materialId,
                    newCost,
                    timestamp: new Date().toISOString(),
                    reason
                };
            });

            return transaction();
        } catch (error) {
            console.error(`❌ Error updating cost for ${materialId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get full cost history for a material
     */
    getCostHistory(materialId) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    id,
                    cost,
                    effective_date,
                    is_current,
                    changed_reason,
                    created_at
                FROM Material_Costs 
                WHERE material_id = ?
                ORDER BY effective_date DESC
            `);
            return stmt.all(materialId);
        } catch (error) {
            console.error(`❌ Error getting cost history for ${materialId}:`, error);
            return [];
        }
    }

    /**
     * Get all current costs (snapshot)
     */
    getAllCurrentCosts() {
        try {
            const stmt = db.prepare(`
                SELECT 
                    mc.material_id,
                    m.name as material_name,
                    mc.cost,
                    mc.effective_date,
                    mc.changed_reason
                FROM Material_Costs mc
                LEFT JOIN Materials m ON mc.material_id = m.materialId
                WHERE mc.is_current = 1
                ORDER BY m.name
            `);
            return stmt.all();
        } catch (error) {
            console.error('❌ Error getting all current costs:', error);
            return [];
        }
    }

    /**
     * Get cost changes in date range
     */
    getCostChanges(materialId, startDate, endDate) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    cost,
                    effective_date,
                    changed_reason,
                    created_at
                FROM Material_Costs 
                WHERE material_id = ?
                AND effective_date BETWEEN ? AND ?
                ORDER BY effective_date DESC
            `);
            return stmt.all(materialId, startDate, endDate);
        } catch (error) {
            console.error(`❌ Error getting cost changes:`, error);
            return [];
        }
    }

    /**
     * Calculate average cost for period
     */
    getAverageCost(materialId, startDate, endDate) {
        try {
            const stmt = db.prepare(`
                SELECT AVG(cost) as average_cost
                FROM Material_Costs 
                WHERE material_id = ?
                AND effective_date BETWEEN ? AND ?
            `);
            const result = stmt.get(materialId, startDate, endDate);
            return result?.average_cost || 0;
        } catch (error) {
            console.error(`❌ Error calculating average cost:`, error);
            return 0;
        }
    }

    /**
     * Bulk update costs (for multiple materials)
     */
    bulkUpdateCosts(updates) {
        try {
            const transaction = db.transaction(() => {
                const results = [];
                
                for (const { materialId, newCost, reason } of updates) {
                    const result = this.updateMaterialCost(materialId, newCost, reason);
                    results.push(result);
                }
                
                return {
                    success: true,
                    updated: results.length,
                    timestamp: new Date().toISOString()
                };
            });

            return transaction();
        } catch (error) {
            console.error('❌ Error in bulk cost update:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate cost difference (for tracking increases/decreases)
     */
    getCostChange(materialId, daysBack = 30) {
        try {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - daysBack);

            const oldCost = this.getCostAtDate(materialId, oldDate.toISOString());
            const currentCost = this.getCurrentCost(materialId);

            if (!oldCost || !currentCost) {
                return { 
                    material_id: materialId,
                    change_percentage: 0,
                    message: 'Insufficient history'
                };
            }

            const changePercent = ((currentCost.cost - oldCost.cost) / oldCost.cost) * 100;

            return {
                material_id: materialId,
                old_cost: oldCost.cost,
                current_cost: currentCost.cost,
                change_amount: currentCost.cost - oldCost.cost,
                change_percentage: parseFloat(changePercent.toFixed(2)),
                period_days: daysBack,
                trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable'
            };
        } catch (error) {
            console.error('❌ Error calculating cost change:', error);
            return null;
        }
    }
}

export default new CostHistoryService();
