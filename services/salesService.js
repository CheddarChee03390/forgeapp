/**
 * Sales Service (Facade)
 * Maintains backward compatibility while delegating to specialized services
 */
import etsyClient from './etsy/etsyClient.js';
import salesRepository from './sales/sales.repository.js';
import analyticsService from './sales/analytics.service.js';
import etsyReceiptsClient from './sales/etsy-receipts.client.js';

class SalesService {
    /**
     * Sync orders from Etsy
     * @param {number|Date} daysBackOrStartDate - Number of days back OR start date
     * @param {Date} endDate - Optional end date (only if first param is Date)
     */
    async syncOrdersFromEtsy(daysBackOrStartDate = 30, endDate = null) {
        try {
            console.log('📥 syncOrdersFromEtsy called with:', { daysBackOrStartDate, endDate, type: typeof daysBackOrStartDate });
            
            // Handle both API signatures: (daysBack) and (startDate, endDate)
            let startDate, finalEndDate;
            if (typeof daysBackOrStartDate === 'number') {
                // Old API: syncOrdersFromEtsy(daysBack)
                finalEndDate = new Date();
                startDate = new Date();
                startDate.setDate(startDate.getDate() - daysBackOrStartDate);
                console.log('✅ Calculated dates from days back:', { startDate: startDate.toISOString(), finalEndDate: finalEndDate.toISOString() });
            } else {
                // New API: syncOrdersFromEtsy(startDate, endDate)
                startDate = new Date(daysBackOrStartDate);
                finalEndDate = endDate ? new Date(endDate) : new Date();
                console.log('✅ Using provided dates:', { startDate: startDate.toISOString(), finalEndDate: finalEndDate.toISOString() });
            }

            // Validate dates
            if (isNaN(startDate.getTime()) || isNaN(finalEndDate.getTime())) {
                console.error('❌ Invalid dates:', { startDate, finalEndDate });
                return { success: false, error: 'Invalid date format' };
            }

            console.log(`🔄 Syncing orders from ${startDate.toISOString().split('T')[0]} to ${finalEndDate.toISOString().split('T')[0]}...`);

            const shopId = await etsyClient.getShopId();
            if (!shopId) {
                return { success: false, error: 'Failed to get shop_id' };
            }

            let synced = 0;
            const errors = [];

            // Fetch all receipts
            const receipts = await etsyReceiptsClient.fetchReceipts(startDate, finalEndDate);

            // Process each receipt
            for (const receipt of receipts) {
                try {
                    // Skip cancelled orders
                    if (receipt.status === 'Canceled') {
                        continue;
                    }

                    // Extract transaction info from receipt
                    const transactions = receipt.transactions || [];
                    for (const transaction of transactions) {
                        // Check if this specific transaction already synced
                        // Use transaction_id to make each sale unique
                        const orderId = `etsy-${receipt.receipt_id}-${transaction.transaction_id}`;
                        const existing = salesRepository.getSaleByOrderId(orderId);
                        if (existing) {
                            continue; // Skip already synced transaction
                        }

                        // Etsy price format: {amount: 1234, divisor: 100, currency_code: "USD"}
                        const price = transaction.price?.amount && transaction.price?.divisor
                            ? transaction.price.amount / transaction.price.divisor
                            : parseFloat(transaction.price) || 0;

                        const saleData = {
                            order_id: orderId,
                            listing_id: transaction.listing_id,
                            sku: transaction.sku || '',
                            product_name: transaction.title || 'Unknown Product',
                            quantity: transaction.quantity,
                            sale_price: price,
                            order_date: new Date(receipt.create_timestamp * 1000).toISOString().split('T')[0],
                            tax_included: receipt.total_tax_cost > 0,
                            notes: `Etsy Order #${receipt.receipt_id}`
                        };

                        const result = this.logSale(saleData);
                        if (result.success) {
                            synced++;
                        } else {
                            errors.push(`Transaction ${transaction.transaction_id}: ${result.error}`);
                        }
                    }
                } catch (err) {
                    errors.push(`Receipt ${receipt.receipt_id}: ${err.message}`);
                }
            }

            return {
                success: true,
                synced,
                message: `Successfully synced ${synced} orders from Etsy`,
                dateRange: { 
                    start: startDate.toISOString().split('T')[0], 
                    end: finalEndDate.toISOString().split('T')[0] 
                },
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
     * Calculate metrics for period
     */
    calculateMetrics(year, month) {
        const sales = salesRepository.getSalesForMonth(year, month);
        return analyticsService.calculateMetrics(sales);
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
