/**
 * Sales Repository
 * All database operations for Sales table
 * Pure CRUD - no business logic or external API calls
 */

import db from '../database.js';
import costHistoryService from '../costHistoryService.js';

class SalesRepository {
    /**
     * Insert a single sale transaction
     */
    logSale(saleData) {
        try {
            const {
                order_id,
                listing_id,
                sku,
                product_name,
                quantity = 1,
                sale_price,
                order_date = new Date().toISOString(),
                material_id,
                tax_included = 0,
                notes
            } = saleData;

            // Get material cost at time of sale (historical lookup)
            // Use material_id if provided, otherwise use sku
            let material_cost_at_sale = 0;
            const materialLookup = material_id || sku;
            if (materialLookup) {
                const costRecord = costHistoryService.getCostAtDate(materialLookup, order_date);
                if (costRecord) {
                    material_cost_at_sale = costRecord.cost * quantity;
                }
            }

            // Insert sale
            const insert = db.prepare(`
                INSERT INTO Sales 
                (order_id, listing_id, sku, product_name, quantity, sale_price, 
                 material_cost_at_sale, tax_included, order_date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = insert.run(
                String(order_id),
                listing_id ? parseInt(listing_id) : null,
                String(sku || ''),
                String(product_name || ''),
                parseInt(quantity) || 1,
                parseFloat(sale_price),
                parseFloat(material_cost_at_sale) || 0,
                tax_included ? 1 : 0,
                String(order_date),
                String(notes || '')
            );

            return {
                success: true,
                sale_id: result.lastInsertRowid,
                order_id,
                material_cost_locked_in: material_cost_at_sale,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error logging sale:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get sales for a specific month
     */
    getSalesForMonth(year, month) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    id,
                    order_id,
                    sku,
                    product_name,
                    quantity,
                    sale_price,
                    material_cost_at_sale,
                    tax_included,
                    order_date,
                    status
                FROM Sales 
                WHERE strftime('%Y', order_date) = ? 
                AND strftime('%m', order_date) = ?
                ORDER BY order_date DESC
            `);
            
            return stmt.all(
                year.toString().padStart(4, '0'),
                month.toString().padStart(2, '0')
            );
        } catch (error) {
            console.error('❌ Error getting monthly sales:', error);
            return [];
        }
    }

    /**
     * Get sales within date range
     */
    getSalesByDateRange(startDate, endDate) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    s.id,
                    s.order_id,
                    s.sku,
                    s.product_name,
                    s.quantity,
                    s.sale_price,
                    s.material_cost_at_sale,
                    s.tax_included,
                    s.order_date,
                    s.status,
                    COALESCE(SUM(f.amount), 0) as etsy_fees
                FROM Sales s
                LEFT JOIN Etsy_Fees f ON s.order_id = f.order_id
                WHERE DATE(s.order_date) BETWEEN ? AND ?
                GROUP BY s.id
                ORDER BY s.order_date DESC
            `);
            
            return stmt.all(startDate, endDate);
        } catch (error) {
            console.error('❌ Error getting sales by date range:', error);
            return [];
        }
    }

    /**
     * Get sales by SKU
     */
    getSalesBySku(sku, limit = 100) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    id,
                    order_id,
                    product_name,
                    quantity,
                    sale_price,
                    material_cost_at_sale,
                    order_date,
                    status
                FROM Sales 
                WHERE sku = ?
                ORDER BY order_date DESC
                LIMIT ?
            `);
            
            return stmt.all(sku, limit);
        } catch (error) {
            console.error('❌ Error getting sales by SKU:', error);
            return [];
        }
    }

    /**
     * Get single sale by ID
     */
    getSaleById(saleId) {
        try {
            const stmt = db.prepare(`
                SELECT * FROM Sales WHERE id = ?
            `);
            return stmt.get(saleId);
        } catch (error) {
            console.error('❌ Error getting sale:', error);
            return null;
        }
    }

    /**
     * Get sale by order ID
     */
    getSaleByOrderId(orderId) {
        try {
            const stmt = db.prepare(`
                SELECT * FROM Sales WHERE order_id = ?
            `);
            return stmt.get(orderId);
        } catch (error) {
            console.error('❌ Error getting sale by order ID:', error);
            return null;
        }
    }

    /**
     * Update sale status
     */
    updateSaleStatus(saleId, newStatus) {
        try {
            const stmt = db.prepare(`
                UPDATE Sales 
                SET status = ? 
                WHERE id = ?
            `);
            stmt.run(newStatus, saleId);
            return { success: true, status: newStatus };
        } catch (error) {
            console.error('❌ Error updating sale status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get profit breakdown by SKU for a month
     */
    getProfitBySku(year, month) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    sku,
                    product_name,
                    COUNT(*) as orders,
                    SUM(quantity) as total_quantity,
                    SUM(sale_price) as total_revenue,
                    SUM(material_cost_at_sale) as total_costs,
                    SUM(sale_price) - SUM(material_cost_at_sale) as profit
                FROM Sales 
                WHERE strftime('%Y', order_date) = ? 
                AND strftime('%m', order_date) = ?
                GROUP BY sku
                ORDER BY profit DESC
            `);
            
            return stmt.all(
                year.toString().padStart(4, '0'),
                month.toString().padStart(2, '0')
            );
        } catch (error) {
            console.error('❌ Error getting profit by SKU:', error);
            return [];
        }
    }

    /**
     * Get top selling products for a month
     */
    getTopProducts(year, month, limit = 10) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    product_name,
                    sku,
                    SUM(quantity) as units_sold,
                    SUM(sale_price) as total_revenue,
                    COUNT(*) as order_count
                FROM Sales 
                WHERE strftime('%Y', order_date) = ? 
                AND strftime('%m', order_date) = ?
                GROUP BY sku
                ORDER BY units_sold DESC
                LIMIT ?
            `);
            
            return stmt.all(
                year.toString().padStart(4, '0'),
                month.toString().padStart(2, '0'),
                limit
            );
        } catch (error) {
            console.error('❌ Error getting top products:', error);
            return [];
        }
    }

    /**
     * Clear all sales data (use with caution!)
     * Also clears related Etsy_Fees records
     */
    clearAllSales() {
        try {
            // Delete fees first (foreign key constraint)
            const feesStmt = db.prepare('DELETE FROM Etsy_Fees');
            const feesResult = feesStmt.run();
            
            // Then delete sales
            const salesStmt = db.prepare('DELETE FROM Sales');
            const salesResult = salesStmt.run();
            
            console.log(`🗑️ Cleared ${feesResult.changes} fee records and ${salesResult.changes} sales records`);
            return { 
                success: true, 
                deleted: {
                    sales: salesResult.changes,
                    fees: feesResult.changes
                }
            };
        } catch (error) {
            console.error('❌ Error clearing sales:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new SalesRepository();
