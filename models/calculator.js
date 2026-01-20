// Calculation Engine - Deterministic cost and profitability calculations
export class Calculator {
    /**
     * Calculate cost of item based on weight and material cost per gram
     * @param {number} weight - Weight in grams
     * @param {number} costPerGram - Material cost per gram
     * @returns {number} - Cost of item (full precision)
     */
    static calculateCostOfItem(weight, costPerGram) {
        const w = parseFloat(weight) || 0;
        const c = parseFloat(costPerGram) || 0;
        return w * c;
    }

    /**
     * Calculate total cost (CostOfItem + PostageCost)
     * @param {number} costOfItem - Cost of item
     * @param {number} postageCost - Postage cost
     * @returns {number} - Total cost
     */
    static calculateTotalCost(costOfItem, postageCost) {
        const item = parseFloat(costOfItem) || 0;
        const postage = parseFloat(postageCost) || 0;
        return item + postage;
    }

    /**
     * Calculate gross profit (TargetPrice - TotalCost)
     * @param {number|null} targetPrice - Target selling price
     * @param {number} totalCost - Total cost
     * @returns {number|null} - Gross profit or null if no target price
     */
    static calculateGrossProfit(targetPrice, totalCost) {
        if (targetPrice === null || targetPrice === undefined) {
            return null;
        }
        const price = parseFloat(targetPrice);
        const cost = parseFloat(totalCost) || 0;
        return price - cost;
    }

    /**
     * Calculate margin percentage ((GrossProfit / TargetPrice) * 100)
     * @param {number|null} grossProfit - Gross profit
     * @param {number|null} targetPrice - Target selling price
     * @returns {number|null} - Margin percentage or null if no profit/price
     */
    static calculateMarginPercent(grossProfit, targetPrice) {
        if (grossProfit === null || targetPrice === null || targetPrice === undefined) {
            return null;
        }
        const profit = parseFloat(grossProfit);
        const price = parseFloat(targetPrice);
        
        if (price === 0) return null;
        
        return (profit / price) * 100;
    }

    /**
     * Format currency for display (2 decimal places)
     * @param {number} value - Numeric value
     * @returns {string} - Formatted currency string
     */
    static formatCurrency(value) {
        if (value === null || value === undefined) return '-';
        return parseFloat(value).toFixed(2);
    }

    /**
     * Format percentage for display (2 decimal places)
     * @param {number} value - Percentage value
     * @returns {string} - Formatted percentage string
     */
    static formatPercent(value) {
        if (value === null || value === undefined) return '-';
        return parseFloat(value).toFixed(2) + '%';
    }

    /**
     * Get margin health status
     * @param {number|null} marginPercent - Margin percentage
     * @param {number} threshold - Warning threshold (default 20%)
     * @returns {string} - 'healthy', 'warning', 'negative', or 'unknown'
     */
    static getMarginHealth(marginPercent, threshold = 20) {
        if (marginPercent === null || marginPercent === undefined) {
            return 'unknown';
        }
        const margin = parseFloat(marginPercent);
        
        if (margin < 0) return 'negative';
        if (margin < threshold) return 'warning';
        return 'healthy';
    }
}
