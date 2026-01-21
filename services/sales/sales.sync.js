/**
 * Sales Sync Service
 * Responsible ONLY for: fetching receipts from Etsy and storing to database
 * Does NOT do calculations—just data extraction and persistence
 */

import salesRepository from './sales.repository.js';

/**
 * Extract price from Etsy format
 * @param {Object} priceObj - {amount: 1234, divisor: 100, currency_code: "GBP"}
 * @returns {number} - Decimal price
 */
function extractPrice(priceObj) {
    if (!priceObj) return 0;
    if (priceObj.amount && priceObj.divisor) {
        return priceObj.amount / priceObj.divisor;
    }
    return typeof priceObj === 'number' ? priceObj : 0;
}

/**
 * Sync receipts to database
 * @param {Array} receipts - Raw receipt objects from Etsy API
 * @returns {Object} - {success, synced, errors}
 */
async function syncReceiptsToDb(receipts) {
    let synced = 0;
    const errors = [];

    for (const receipt of receipts) {
        try {
            const receiptTaxCost = extractPrice(receipt.total_tax_cost);
            const receiptGrandTotal = extractPrice(receipt.grandtotal);

            const transactions = receipt.transactions || [];
            if (transactions.length === 0) continue;

            // Sum of transaction item prices (for proportional allocation)
            const sumNetPrices = transactions.reduce((sum, tx) => {
                return sum + extractPrice(tx.price);
            }, 0);

            const transactionCount = transactions.length;
            const taxPerTransaction = receiptTaxCost / transactionCount;

            for (const transaction of transactions) {
                const orderId = `etsy-${receipt.receipt_id}-${transaction.transaction_id}`;
                const existing = salesRepository.getSaleByOrderId(orderId);

                // Calculate this transaction's share of the grand total
                const netPrice = extractPrice(transaction.price);
                const priceShare = sumNetPrices > 0 ? netPrice / sumNetPrices : 1 / transactionCount;
                const salePrice = receiptGrandTotal > 0 ? receiptGrandTotal * priceShare : netPrice;

                // If already exists, backfill if needed
                if (existing) {
                    if ((existing.tax_amount ?? 0) === 0 && taxPerTransaction > 0) {
                        salesRepository.updateTaxAmount(orderId, taxPerTransaction);
                    }
                    const needsUpdate = Math.abs((existing.sale_price ?? 0) - salePrice) > 0.0001;
                    if (needsUpdate) {
                        salesRepository.updateSalePrice(orderId, salePrice);
                    }
                    continue;
                }

                // Insert new sale
                const saleData = {
                    order_id: orderId,
                    etsy_order_number: String(receipt.receipt_id),
                    listing_id: transaction.listing_id,
                    sku: transaction.sku || '',
                    product_name: transaction.title || 'Unknown Product',
                    quantity: transaction.quantity,
                    sale_price: salePrice,
                    tax_amount: taxPerTransaction,
                    order_date: new Date(receipt.create_timestamp * 1000).toISOString().split('T')[0],
                    tax_included: receiptTaxCost > 0,
                    status: receipt.status || 'Complete',
                    notes: `Etsy Order #${receipt.receipt_id}`
                };

                const result = salesRepository.logSale(saleData);
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
        success: errors.length === 0 || synced > 0,
        synced,
        errors: errors.length > 0 ? errors : undefined
    };
}

export default {
    syncReceiptsToDb
};
