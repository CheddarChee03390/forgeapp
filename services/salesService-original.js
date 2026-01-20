// Sales Service - Manages sales transactions and Etsy sync
import db from './database.js';
import etsyService from './etsyService.js';
import etsyOAuthService from './etsyOAuthService.js';
import costHistoryService from './costHistoryService.js';
import fetch from 'node-fetch';

class SalesService {
    /**
     * Fetch orders from Etsy API and store locally
     * Only stores tax-relevant data (no customer info)
     */
    async syncOrdersFromEtsy(daysBack = 30) {
        try {
            console.log(`🔄 Syncing orders from last ${daysBack} days...`);

            // Get tokens from OAuth service (handles decryption)
            const tokens = etsyOAuthService.getStoredTokens();
            if (!tokens || !tokens.accessToken) {
                return { success: false, error: 'No Etsy authentication token found' };
            }

            if (!tokens.shopId) {
                return { success: false, error: 'No Etsy shop ID found' };
            }

            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
            const startTimestamp = Math.floor(startDate.getTime() / 1000);

            const shopId = tokens.shopId;
            const accessToken = tokens.accessToken;

            // Fetch receipts from Etsy API
            // API endpoint: GET /v3/application/shops/{shop_id}/receipts
            let synced = 0;
            let errors = [];
            let hasMore = true;
            let offset = 0;
            const limit = 100;

            while (hasMore) {
                try {
                    const response = await fetch(
                        `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?limit=${limit}&offset=${offset}&was_paid=true`,
                        {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (!response.ok) {
                        if (response.status === 401) {
                            return { success: false, error: 'Etsy authentication failed - token may be expired' };
                        }
                        throw new Error(`Etsy API error: ${response.status}`);
                    }

                    const data = await response.json();
                    const receipts = data.results || [];

                    // Process each receipt
                    for (const receipt of receipts) {
                        try {
                            // Check if receipt already synced
                            const existing = db.prepare(
                                'SELECT id FROM Sales WHERE order_id = ?'
                            ).get(`etsy-${receipt.receipt_id}`);

                            if (existing) {
                                continue; // Skip already synced orders
                            }

                            // Extract transaction info from receipt
                            const transactions = receipt.transactions || [];
                            for (const transaction of transactions) {
                                const saleData = {
                                    order_id: `etsy-${receipt.receipt_id}`,
                                    listing_id: transaction.listing_id,
                                    sku: transaction.sku || '',
                                    product_name: transaction.title || 'Unknown Product',
                                    quantity: transaction.quantity,
                                    sale_price: parseFloat(transaction.price),
                                    order_date: new Date(receipt.create_timestamp * 1000).toISOString().split('T')[0],
                                    tax_included: receipt.total_tax_cost > 0,
                                    notes: `Synced from Etsy receipt #${receipt.receipt_id}`
                                };

                                // Try to log the sale
                                const result = this.logSale(saleData);
                                if (result.success) {
                                    synced++;
                                }
                            }
                        } catch (err) {
                            errors.push(`Receipt ${receipt.receipt_id}: ${err.message}`);
                        }
                    }

                    // Check if there are more results
                    hasMore = receipts.length === limit;
                    offset += limit;
                } catch (err) {
                    return {
                        success: false,
                        synced,
                        error: err.message,
                        errors
                    };
                }
            }

            return {
                success: true,
                synced,
                message: `Successfully synced ${synced} orders from Etsy`,
                dateRange: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
                errors: errors.length > 0 ? errors : undefined
            };
        } catch (error) {
            console.error('❌ Error syncing orders:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Log a single sale transaction
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
     * Get sales for a month
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
     * Get sales for date range
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
     * Get single sale details
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
     * Get sales by order ID
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
     * Calculate metrics for period
     */
    calculateMetrics(year, month) {
        try {
            const sales = this.getSalesForMonth(year, month);
            
            if (sales.length === 0) {
                return {
                    total_revenue: 0,
                    total_costs: 0,
                    total_profit: 0,
                    units_sold: 0,
                    average_order_value: 0,
                    profit_margin_percent: 0
                };
            }

            const totalRevenue = sales.reduce((sum, s) => sum + s.sale_price, 0);
            const totalCosts = sales.reduce((sum, s) => sum + (s.material_cost_at_sale || 0), 0);
            const totalProfit = totalRevenue - totalCosts;
            const unitsSold = sales.reduce((sum, s) => sum + s.quantity, 0);

            return {
                total_revenue: parseFloat(totalRevenue.toFixed(2)),
                total_costs: parseFloat(totalCosts.toFixed(2)),
                total_profit: parseFloat(totalProfit.toFixed(2)),
                units_sold: unitsSold,
                average_order_value: parseFloat((totalRevenue / sales.length).toFixed(2)),
                profit_margin_percent: parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2)),
                order_count: sales.length
            };
        } catch (error) {
            console.error('❌ Error calculating metrics:', error);
            return null;
        }
    }

    /**
     * Get profit by SKU
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
     * Get top selling products
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
}

export default new SalesService();
