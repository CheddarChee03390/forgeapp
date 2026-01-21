/**
 * Sales Service (Thin Orchestration Layer)
 * 
 * Single Responsibility: Coordinate data flow between specialized services
 * - salesSync: Fetch from Etsy, parse, insert to DB
 * - salesCalculator: Compute metrics from Sales records
 * - salesRepository: CRUD operations
 * 
 * This layer owns NO business logic—it delegates to specialized services.
 */
import etsyClient from './etsy/etsyClient.js';
import salesRepository from './sales/sales.repository.js';
import salesSync from './sales/sales.sync.js';
import salesCalculator from './sales/sales.calculator.js';
import etsyReceiptsClient from './sales/etsy-receipts.client.js';

class SalesService {
    /**
     * Sync orders from Etsy using specialized sync service
     * @param {number|Date} daysBackOrStartDate - Number of days back OR start date
     * @param {Date} endDate - Optional end date (only if first param is Date)
     * @returns {Promise<{success: boolean, synced: number, message: string, dateRange: Object, errors?: string[]}>}
     */
    async syncOrdersFromEtsy(daysBackOrStartDate = 30, endDate = null) {
        try {
            // Parse date arguments
            let startDate, finalEndDate;
            if (typeof daysBackOrStartDate === 'number') {
                finalEndDate = new Date();
                startDate = new Date();
                startDate.setDate(startDate.getDate() - daysBackOrStartDate);
            } else {
                startDate = new Date(daysBackOrStartDate);
                finalEndDate = endDate ? new Date(endDate) : new Date();
            }

            // Validate
            if (isNaN(startDate.getTime()) || isNaN(finalEndDate.getTime())) {
                return { success: false, error: 'Invalid date format' };
            }

            console.log(`🔄 Syncing Etsy orders from ${startDate.toISOString().split('T')[0]} to ${finalEndDate.toISOString().split('T')[0]}`);

            // Get shop ID
            const shopId = await etsyClient.getShopId();
            if (!shopId) {
                return { success: false, error: 'Failed to get shop_id' };
            }

            // Fetch receipts from Etsy
            const receipts = await etsyReceiptsClient.fetchReceipts(startDate, finalEndDate);
            if (!receipts || receipts.length === 0) {
                return { success: true, synced: 0, message: 'No receipts found for date range', dateRange: { start: startDate.toISOString().split('T')[0], end: finalEndDate.toISOString().split('T')[0] } };
            }

            // Delegate to specialized sync service (fetch → parse → store)
            const syncResult = await salesSync.syncReceiptsToDb(receipts);

            return {
                success: syncResult.success,
                synced: syncResult.synced,
                message: `Successfully synced ${syncResult.synced} orders from Etsy`,
                dateRange: { start: startDate.toISOString().split('T')[0], end: finalEndDate.toISOString().split('T')[0] },
                errors: syncResult.errors?.length > 0 ? syncResult.errors : undefined
            };
        } catch (error) {
            console.error('❌ Error syncing orders:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get sales metrics for date range
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {number} taxRate - Tax rate (e.g., 0.20 for 20%)
     * @param {number} shopLevelFees - Fees not linked to orders (marketing, postage, etc.)
     * @returns {{total_revenue, net_revenue, gross_profit, ...}}
     */
    getSalesMetrics(startDate, endDate, taxRate = 0.0, shopLevelFees = 0) {
        const sales = salesRepository.getSalesByDateRange(startDate, endDate);
        return salesCalculator.calculateMetrics(sales, taxRate, shopLevelFees);
    }

    /**
     * Get profitability breakdown by SKU
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {Array} SKUs sorted by profit descending
     */
    getProfitabilityBySku(startDate, endDate) {
        const sales = salesRepository.getSalesByDateRange(startDate, endDate);
        return salesCalculator.calculateProfitabilityBySku(sales);
    }

    /**
     * BACKWARD COMPATIBILITY: Calculate metrics for a specific month
     * Used by existing routes; delegates to getSalesMetrics()
     * @param {number} year - YYYY
     * @param {number} month - 1-12
     * @returns {Object} Metrics object
     */
    calculateMetrics(year, month) {
        const sales = salesRepository.getSalesForMonth(year, month);
        return salesCalculator.calculateMetrics(sales, 0.0, 0);
    }

    // ===== Repository Delegation (CRUD & Retrieval) =====

    /**
     * Log a single sale transaction
     */
    logSale(saleData) {
        return salesRepository.logSale(saleData);
    }

    /**
     * Get sales for a month
     */
    getSalesForMonth(year, month) {
        return salesRepository.getSalesForMonth(year, month);
    }

    /**
     * Get sales for date range
     */
    getSalesByDateRange(startDate, endDate) {
        return salesRepository.getSalesByDateRange(startDate, endDate);
    }

    /**
     * Get sales by SKU
     */
    getSalesBySku(sku, limit = 100) {
        return salesRepository.getSalesBySku(sku, limit);
    }

    /**
     * Get single sale details
     */
    getSaleById(saleId) {
        return salesRepository.getSaleById(saleId);
    }

    /**
     * Get sales by order ID
     */
    getSaleByOrderId(orderId) {
        return salesRepository.getSaleByOrderId(orderId);
    }

    /**
     * Update sale status
     */
    updateSaleStatus(saleId, newStatus) {
        return salesRepository.updateSaleStatus(saleId, newStatus);
    }

    /**
     * Get profit by SKU
     */
    getProfitBySku(year, month) {
        return salesRepository.getProfitBySku(year, month);
    }

    /**
     * Get top selling products
     */
    getTopProducts(year, month, limit = 10) {
        return salesRepository.getTopProducts(year, month, limit);
    }

    /**
     * Clear all sales data
     */
    clearAllSales() {
        return salesRepository.clearAllSales();
    }
}

export default new SalesService();
