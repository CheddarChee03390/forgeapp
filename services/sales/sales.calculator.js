/**
 * Sales Calculator Service
 * Responsible ONLY for: computing metrics and analytics from sales data
 * Does NOT fetch or store—just calculations
 */

/**
 * Calculate all sales metrics from an array of Sale objects
 * @param {Array} sales - Array of Sale records from database
 * @param {number} taxRate - Tax rate for estimates (default 0.20)
 * @returns {Object} - Comprehensive metrics object
 */
function calculateMetrics(sales, taxRate = 0.20, shopLevelFees = 0) {
    let totalRevenue = 0;        // Sum of sale_price
    let totalRefunds = 0;
    let totalCost = 0;
    let totalCostRefunded = 0;
    let totalFees = 0;
    let totalFeesRefunded = 0;
    let totalTaxFromCustomers = 0;  // Sum of tax_amount
    let unitsSold = 0;

    sales.forEach(sale => {
        const isRefunded = sale.status === 'refunded' || sale.status === 'cancelled';

        if (!isRefunded) {
            totalRevenue += sale.sale_price || 0;
            totalCost += sale.material_cost_at_sale || 0;
            // Fees are stored as negative in DB, convert to positive for calculations
            totalFees += Math.abs(sale.etsy_fees || 0);
            totalTaxFromCustomers += sale.tax_amount || 0;
            unitsSold += sale.quantity || 1;
        } else {
            totalRefunds += sale.sale_price || 0;
            totalCostRefunded += sale.material_cost_at_sale || 0;
            // Fees are stored as negative in DB, convert to positive for calculations
            totalFeesRefunded += Math.abs(sale.etsy_fees || 0);
        }
    });

    // Shop-level fees provided by caller (fallback 0)
    const allFees = totalFees + (shopLevelFees || 0);

    // Net calculations
    const netRevenue = totalRevenue - totalTaxFromCustomers - totalRefunds;
    const netCost = totalCost - totalCostRefunded;
    const netFees = allFees - totalFeesRefunded;

    // Profit
    const grossProfit = netRevenue - netCost;
    const netProfit = netRevenue - netCost - netFees;
    const estimatedTax = netProfit * taxRate;
    const profitMargin = netRevenue > 0 ? (netProfit / netRevenue * 100) : 0;
    const netProfitAfterTax = netProfit - estimatedTax;

    return {
        total_revenue: totalRevenue,
        total_refunds: totalRefunds,
        net_revenue: netRevenue,
        gross_profit: grossProfit,
        total_profit: netProfit,
        total_cost: netCost,
        total_fees: netFees,
        units_sold: unitsSold,
        sales_tax_paid_by_customer: totalTaxFromCustomers,
        average_order_value: sales.length > 0 ? totalRevenue / sales.length : 0,
        profit_margin_percent: profitMargin,
        estimated_tax: estimatedTax,
        net_profit_after_tax: netProfitAfterTax
    };
}

/**
 * Calculate profitability by SKU
 * @param {Array} sales - Array of Sale records
 * @returns {Array} - Sorted by profit descending
 */
function calculateProfitabilityBySku(sales) {
    const bySkus = {};

    sales.forEach(sale => {
        if (sale.status === 'refunded' || sale.status === 'cancelled') {
            return;
        }

        if (!bySkus[sale.sku]) {
            bySkus[sale.sku] = {
                sku: sale.sku,
                product_name: sale.product_name,
                quantity: 0,
                total_revenue: 0,
                total_cost: 0,
                total_fees: 0,
                total_profit: 0
            };
        }

        bySkus[sale.sku].quantity += sale.quantity || 1;
        bySkus[sale.sku].total_revenue += sale.sale_price || 0;
        bySkus[sale.sku].total_cost += sale.material_cost_at_sale || 0;
        // Fees are stored as negative in DB, convert to positive for calculations
        bySkus[sale.sku].total_fees += Math.abs(sale.etsy_fees || 0);
        bySkus[sale.sku].total_profit =
            bySkus[sale.sku].total_revenue - bySkus[sale.sku].total_cost - bySkus[sale.sku].total_fees;
    });

    return Object.values(bySkus).sort((a, b) => b.total_profit - a.total_profit);
}

export default {
    calculateMetrics,
    calculateProfitabilityBySku
};
