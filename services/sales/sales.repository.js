/**
 * Sales Repository
 * All database operations for Sales table
 * Pure CRUD - no business logic or external API calls
 */

import db from '../database.js';
import costHistoryService from '../costHistoryService.js';
import supplierCostsService from '../supplierCostsService.js';

class SalesRepository {
    /**
     * Insert a single sale transaction
     */
    logSale(saleData) {
        try {
            const {
                order_id,
                etsy_order_number,
                listing_id,
                sku,
                product_name,
                quantity = 1,
                sale_price,
                tax_amount = 0,
                order_date = new Date().toISOString(),
                material_id,
                tax_included = 0,
                status = 'pending',
                notes
            } = saleData;

            // Get cost at time of sale with historical logic
            // Priority: Supplier Cost (only if effective on/before order_date) → Material (weight × rate) → 0
            let material_cost_at_sale = 0;

            if (sku) {
                // 1) Supplier cost (strict by date)
                const supplierCost = supplierCostsService.getCostForDate(sku, order_date);
                if (supplierCost !== null) {
                    material_cost_at_sale = parseFloat(supplierCost) * (parseInt(quantity) || 1);
                } else {
                    // 2) Weight × material rate at order_date
                    let resolvedSku = String(sku);
                    try {
                        const original = String(sku || '');
                        const stripped = original.startsWith('ETSY_') ? original.slice(5) : original;
                        const dashToUnderscore = (s) => s.replace(/-/g, '_');
                        const candidates = [original, stripped, dashToUnderscore(original), dashToUnderscore(stripped)];
                        for (const candidate of candidates) {
                            const mapRow = db.prepare(`
                                SELECT internal_sku 
                                FROM Marketplace_Sku_Map 
                                WHERE variation_sku = ? COLLATE NOCASE
                                AND (is_active = 1 OR is_active IS NULL)
                                ORDER BY rowid DESC
                                LIMIT 1
                            `).get(candidate);
                            if (mapRow && mapRow.internal_sku) { resolvedSku = mapRow.internal_sku; break; }
                        }
                        if (resolvedSku === String(sku)) {
                            // If still unresolved, but SKU exists in Master_Skus, treat it as internal
                            const exists = db.prepare(`SELECT 1 FROM Master_Skus WHERE SKU = ? LIMIT 1`).get(stripped);
                            if (exists) resolvedSku = stripped;
                        }
                    } catch {}

                    let weight = 0;
                    let materialIdForLookup = material_id || null;
                    try {
                        const skuRow = db.prepare(`
                            SELECT SKU, Weight, Material 
                            FROM Master_Skus 
                            WHERE SKU = ?
                            LIMIT 1
                        `).get(resolvedSku);
                        if (skuRow) {
                            weight = parseFloat(skuRow.Weight) || 0;
                            if (!materialIdForLookup && skuRow.Material) materialIdForLookup = skuRow.Material;
                        }
                    } catch {}

                    if (materialIdForLookup) {
                        const rateRecord = costHistoryService.getCostAtDate(String(materialIdForLookup), order_date);
                        if (rateRecord && typeof rateRecord.cost === 'number') {
                            const perUnit = (parseFloat(weight) || 0) * rateRecord.cost;
                            material_cost_at_sale = perUnit * (parseInt(quantity) || 1);
                        }
                    }
                }
            }

            // Insert sale
            const insert = db.prepare(`
                INSERT INTO Sales 
                (order_id, etsy_order_number, listing_id, sku, product_name, quantity, sale_price, 
                 material_cost_at_sale, tax_amount, tax_included, order_date, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = insert.run(
                String(order_id),
                String(etsy_order_number || ''),
                listing_id ? parseInt(listing_id) : null,
                String(sku || ''),
                String(product_name || ''),
                parseInt(quantity) || 1,
                parseFloat(sale_price),
                parseFloat(material_cost_at_sale) || 0,
                parseFloat(tax_amount) || 0,
                tax_included ? 1 : 0,
                String(order_date),
                String(status || 'pending'),
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
                    tax_amount,
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
                    s.tax_amount,
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
                    tax_amount,
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
     * Update tax amount for an order
     */
    updateTaxAmount(orderId, taxAmount) {
        try {
            const stmt = db.prepare(`
                UPDATE Sales
                SET tax_amount = ?
                WHERE order_id = ?
            `);
            const res = stmt.run(parseFloat(taxAmount) || 0, String(orderId));
            return { success: true, updated: res.changes };
        } catch (error) {
            console.error('❌ Error updating tax amount:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update sale price for an order
     */
    updateSalePrice(orderId, salePrice) {
        try {
            const stmt = db.prepare(`
                UPDATE Sales
                SET sale_price = ?
                WHERE order_id = ?
            `);
            const res = stmt.run(parseFloat(salePrice) || 0, String(orderId));
            return { success: true, updated: res.changes };
        } catch (error) {
            console.error('❌ Error updating sale price:', error);
            return { success: false, error: error.message };
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
