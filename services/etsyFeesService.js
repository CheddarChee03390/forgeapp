// Etsy Fees Calculation Service
import db from './database.js';

class EtsyFeesService {
    constructor() {
        // UK Etsy fee rates (as of 2024)
        this.TRANSACTION_FEE_RATE = 0.065;        // 6.5% transaction fee
        this.PAYMENT_PROCESSING_RATE = 0.03;     // 3% payment processing
        this.PAYMENT_PROCESSING_FIXED = 0.25;    // £0.25 fixed fee
        this.REGULATORY_FEE_RATE = 0.0025;       // 0.25% regulatory operating fee (UK)
    }

    /**
     * Calculate all Etsy fees for a given sale price
     * @param {number} salePrice - Total sale price including shipping
     * @param {number} shippingCost - Shipping cost (optional, defaults to 0)
     * @returns {object} Breakdown of all fees
     */
    calculateFees(salePrice, shippingCost = 0) {
        // Transaction fee: 6.5% of total (item + shipping)
        const transactionFee = parseFloat((salePrice * this.TRANSACTION_FEE_RATE).toFixed(2));

        // Payment processing: 3% + £0.25 of total
        const paymentProcessing = parseFloat(((salePrice * this.PAYMENT_PROCESSING_RATE) + this.PAYMENT_PROCESSING_FIXED).toFixed(2));

        // Regulatory operating fee: 0.25% of total (UK only)
        const regulatoryFee = parseFloat((salePrice * this.REGULATORY_FEE_RATE).toFixed(2));

        // Total fees
        const totalFees = parseFloat((transactionFee + paymentProcessing + regulatoryFee).toFixed(2));

        return {
            transactionFee,
            paymentProcessing,
            regulatoryFee,
            totalFees,
            salePrice,
            netRevenue: parseFloat((salePrice - totalFees).toFixed(2))
        };
    }

    /**
     * Store calculated fees for an order in the database
     * @param {string} orderId - Unique order ID
     * @param {number} salePrice - Sale price
     * @param {string} orderDate - Order date
     * @param {number} shippingCost - Shipping cost (optional)
     * @returns {object} Result with success status
     */
    storeFees(orderId, salePrice, orderDate, shippingCost = 0) {
        try {
            const fees = this.calculateFees(salePrice, shippingCost);

            // Delete existing fees for this order (in case of re-calculation)
            const deleteStmt = db.prepare('DELETE FROM Etsy_Fees WHERE order_id = ?');
            deleteStmt.run(orderId);

            // Insert new fee records
            const insertStmt = db.prepare(`
                INSERT INTO Etsy_Fees (order_id, fee_type, amount, description, charged_date)
                VALUES (?, ?, ?, ?, ?)
            `);

            const insert = db.transaction((orderId, fees, orderDate) => {
                // Transaction fee
                insertStmt.run(
                    orderId,
                    'transaction_fee',
                    fees.transactionFee,
                    `Transaction fee (6.5% of £${salePrice.toFixed(2)})`,
                    orderDate
                );

                // Payment processing fee
                insertStmt.run(
                    orderId,
                    'payment_processing',
                    fees.paymentProcessing,
                    `Payment processing (3% + £0.25 of £${salePrice.toFixed(2)})`,
                    orderDate
                );

                // Regulatory fee
                insertStmt.run(
                    orderId,
                    'regulatory_fee',
                    fees.regulatoryFee,
                    `Regulatory operating fee (0.25% of £${salePrice.toFixed(2)})`,
                    orderDate
                );
            });

            insert(orderId, fees, orderDate);

            return {
                success: true,
                orderId,
                fees
            };
        } catch (error) {
            console.error(`❌ Error storing fees for order ${orderId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get total fees for a specific order
     * @param {string} orderId - Order ID
     * @returns {number} Total fees for the order
     */
    getOrderFees(orderId) {
        try {
            const stmt = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total_fees
                FROM Etsy_Fees
                WHERE order_id = ?
            `);
            const result = stmt.get(orderId);
            return result?.total_fees || 0;
        } catch (error) {
            console.error(`❌ Error getting fees for order ${orderId}:`, error.message);
            return 0;
        }
    }

    /**
     * Get fee breakdown for a specific order
     * @param {string} orderId - Order ID
     * @returns {array} Array of fee records
     */
    getOrderFeeBreakdown(orderId) {
        try {
            const stmt = db.prepare(`
                SELECT fee_type, amount, description, charged_date
                FROM Etsy_Fees
                WHERE order_id = ?
                ORDER BY fee_type
            `);
            return stmt.all(orderId);
        } catch (error) {
            console.error(`❌ Error getting fee breakdown for order ${orderId}:`, error.message);
            return [];
        }
    }

    /**
     * Get total fees for a date range
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {object} Fee totals by type
     */
    getFeesForDateRange(startDate, endDate) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    fee_type,
                    SUM(amount) as total,
                    COUNT(*) as count
                FROM Etsy_Fees
                WHERE DATE(charged_date) BETWEEN DATE(?) AND DATE(?)
                GROUP BY fee_type
            `);
            const results = stmt.all(startDate, endDate);

            let totalFees = 0;
            const breakdown = {};

            results.forEach(row => {
                breakdown[row.fee_type] = {
                    total: parseFloat(row.total.toFixed(2)),
                    count: row.count
                };
                totalFees += row.total;
            });

            return {
                totalFees: parseFloat(totalFees.toFixed(2)),
                breakdown
            };
        } catch (error) {
            console.error('❌ Error getting fees for date range:', error.message);
            return { totalFees: 0, breakdown: {} };
        }
    }

    /**
     * Get monthly fee summary
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @returns {object} Monthly fee summary
     */
    getMonthlyFees(year, month) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    fee_type,
                    SUM(amount) as total,
                    COUNT(*) as count
                FROM Etsy_Fees
                WHERE strftime('%Y', charged_date) = ? 
                AND strftime('%m', charged_date) = ?
                GROUP BY fee_type
            `);

            const yearStr = year.toString();
            const monthStr = month.toString().padStart(2, '0');
            const results = stmt.all(yearStr, monthStr);

            let totalFees = 0;
            const breakdown = {};

            results.forEach(row => {
                breakdown[row.fee_type] = {
                    total: parseFloat(row.total.toFixed(2)),
                    count: row.count
                };
                totalFees += row.total;
            });

            return {
                year,
                month,
                totalFees: parseFloat(totalFees.toFixed(2)),
                breakdown
            };
        } catch (error) {
            console.error(`❌ Error getting monthly fees for ${year}-${month}:`, error.message);
            return { year, month, totalFees: 0, breakdown: {} };
        }
    }

    /**
     * Recalculate fees for all existing orders
     * @returns {object} Result with counts
     */
    recalculateAllFees() {
        try {
            console.log('🔄 Recalculating fees for all orders...');

            // Get all sales with prices
            const salesStmt = db.prepare(`
                SELECT order_id, sale_price, order_date
                FROM Sales
                WHERE sale_price > 0
            `);
            const sales = salesStmt.all();

            let successCount = 0;
            let errorCount = 0;

            sales.forEach(sale => {
                const result = this.storeFees(sale.order_id, sale.sale_price, sale.order_date);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            });

            console.log(`✅ Recalculated fees for ${successCount} orders`);
            if (errorCount > 0) {
                console.log(`⚠️ ${errorCount} orders had errors`);
            }

            return {
                success: true,
                totalOrders: sales.length,
                successCount,
                errorCount
            };
        } catch (error) {
            console.error('❌ Error recalculating fees:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get fee statistics summary
     * @returns {object} Overall fee statistics
     */
    getFeeStats() {
        try {
            const stmt = db.prepare(`
                SELECT 
                    COUNT(DISTINCT order_id) as orders_with_fees,
                    SUM(amount) as total_fees,
                    AVG(amount) as avg_fee_per_transaction,
                    MIN(charged_date) as earliest_fee,
                    MAX(charged_date) as latest_fee
                FROM Etsy_Fees
            `);
            const result = stmt.get();

            // Calculate average fee per order
            const avgPerOrderStmt = db.prepare(`
                SELECT AVG(order_total) as avg_per_order
                FROM (
                    SELECT order_id, SUM(amount) as order_total
                    FROM Etsy_Fees
                    GROUP BY order_id
                )
            `);
            const avgResult = avgPerOrderStmt.get();

            return {
                ordersWithFees: result.orders_with_fees || 0,
                totalFees: parseFloat((result.total_fees || 0).toFixed(2)),
                avgFeePerTransaction: parseFloat((result.avg_fee_per_transaction || 0).toFixed(2)),
                avgFeePerOrder: parseFloat((avgResult.avg_per_order || 0).toFixed(2)),
                earliestFee: result.earliest_fee,
                latestFee: result.latest_fee
            };
        } catch (error) {
            console.error('❌ Error getting fee stats:', error.message);
            return {
                ordersWithFees: 0,
                totalFees: 0,
                avgFeePerTransaction: 0,
                avgFeePerOrder: 0
            };
        }
    }
}

export default new EtsyFeesService();
