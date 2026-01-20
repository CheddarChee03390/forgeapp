/**
 * Sales Analytics Service
 * Pure calculation functions for sales metrics
 * No database access - operates on data passed in
 */

class AnalyticsService {
    /**
     * Calculate metrics for a collection of sales
     */
    calculateMetrics(sales) {
        try {
            if (!sales || sales.length === 0) {
                return {
                    total_revenue: 0,
                    total_costs: 0,
                    total_profit: 0,
                    units_sold: 0,
                    average_order_value: 0,
                    profit_margin_percent: 0,
                    order_count: 0
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
     * Calculate profit margin percentage
     */
    calculateProfitMargin(revenue, costs) {
        if (revenue === 0) return 0;
        return parseFloat((((revenue - costs) / revenue) * 100).toFixed(2));
    }

    /**
     * Calculate average order value
     */
    calculateAverageOrderValue(totalRevenue, orderCount) {
        if (orderCount === 0) return 0;
        return parseFloat((totalRevenue / orderCount).toFixed(2));
    }

    /**
     * Aggregate sales by product
     */
    aggregateByProduct(sales) {
        const productMap = new Map();

        for (const sale of sales) {
            const key = sale.sku || sale.product_name;
            
            if (!productMap.has(key)) {
                productMap.set(key, {
                    sku: sale.sku,
                    product_name: sale.product_name,
                    orders: 0,
                    units_sold: 0,
                    total_revenue: 0,
                    total_costs: 0
                });
            }

            const product = productMap.get(key);
            product.orders += 1;
            product.units_sold += sale.quantity;
            product.total_revenue += sale.sale_price;
            product.total_costs += (sale.material_cost_at_sale || 0);
        }

        return Array.from(productMap.values());
    }

    /**
     * Calculate growth percentage between two periods
     */
    calculateGrowth(currentValue, previousValue) {
        if (previousValue === 0) return currentValue > 0 ? 100 : 0;
        return parseFloat((((currentValue - previousValue) / previousValue) * 100).toFixed(2));
    }
}

export default new AnalyticsService();
