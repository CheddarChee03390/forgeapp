// Tax Report Service - Calculates taxes and generates reports
import db from './database.js';
import salesService from './salesService.js';

class TaxReportService {
    /**
     * Calculate monthly tax estimate
     */
    calculateMonthlyTax(year, month, taxRate = 0.25) {
        try {
            const metrics = salesService.calculateMetrics(year, month);
            
            if (!metrics) {
                return { success: false, error: 'No sales data' };
            }

            const grossProfit = metrics.total_profit;
            const estimatedTax = grossProfit * taxRate;

            // Cache in database
            this.cacheMonthlyReport(year, month, metrics, estimatedTax, taxRate);

            return {
                success: true,
                year,
                month,
                total_revenue: metrics.total_revenue,
                total_costs: metrics.total_costs,
                total_etsy_fees: 0, // TODO: sum from Etsy_Fees table
                gross_profit: grossProfit,
                tax_rate: (taxRate * 100),
                estimated_tax: parseFloat(estimatedTax.toFixed(2)),
                net_profit: parseFloat((grossProfit - estimatedTax).toFixed(2)),
                units_sold: metrics.units_sold,
                order_count: metrics.order_count
            };
        } catch (error) {
            console.error('❌ Error calculating monthly tax:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate quarterly tax estimate
     */
    calculateQuarterlyTax(year, quarter, taxRate = 0.25) {
        try {
            const quarters = {
                1: [1, 2, 3],
                2: [4, 5, 6],
                3: [7, 8, 9],
                4: [10, 11, 12]
            };

            const months = quarters[quarter];
            if (!months) {
                return { success: false, error: 'Invalid quarter (1-4)' };
            }

            let totalRevenue = 0;
            let totalCosts = 0;
            let totalFees = 0;
            let totalUnits = 0;
            let monthlyBreakdown = [];

            for (const month of months) {
                const metrics = salesService.calculateMetrics(year, month);
                const fees = this.getFeesForMonth(year, month);

                if (metrics) {
                    totalRevenue += metrics.total_revenue;
                    totalCosts += metrics.total_costs;
                    totalUnits += metrics.units_sold;
                    totalFees += fees.total;

                    monthlyBreakdown.push({
                        month,
                        revenue: metrics.total_revenue,
                        costs: metrics.total_costs,
                        profit: metrics.total_profit,
                        units: metrics.units_sold
                    });
                }
            }

            const grossProfit = totalRevenue - totalCosts;
            const estimatedTax = grossProfit * taxRate;

            return {
                success: true,
                year,
                quarter,
                period: `Q${quarter} ${year}`,
                total_revenue: parseFloat(totalRevenue.toFixed(2)),
                total_costs: parseFloat(totalCosts.toFixed(2)),
                total_etsy_fees: parseFloat(totalFees.toFixed(2)),
                gross_profit: parseFloat(grossProfit.toFixed(2)),
                tax_rate: (taxRate * 100),
                estimated_tax: parseFloat(estimatedTax.toFixed(2)),
                net_profit: parseFloat((grossProfit - estimatedTax).toFixed(2)),
                units_sold: totalUnits,
                monthly_breakdown: monthlyBreakdown
            };
        } catch (error) {
            console.error('❌ Error calculating quarterly tax:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate yearly tax estimate
     */
    calculateYearlyTax(year, taxRate = 0.25) {
        try {
            let totalRevenue = 0;
            let totalCosts = 0;
            let totalFees = 0;
            let totalUnits = 0;
            let quarterlyBreakdown = [];

            for (let quarter = 1; quarter <= 4; quarter++) {
                const qData = this.calculateQuarterlyTax(year, quarter, taxRate);
                
                if (qData.success) {
                    totalRevenue += qData.total_revenue;
                    totalCosts += qData.total_costs;
                    totalFees += qData.total_etsy_fees;
                    totalUnits += qData.units_sold;

                    quarterlyBreakdown.push({
                        quarter,
                        revenue: qData.total_revenue,
                        costs: qData.total_costs,
                        fees: qData.total_etsy_fees,
                        profit: qData.gross_profit,
                        tax_estimate: qData.estimated_tax
                    });
                }
            }

            const grossProfit = totalRevenue - totalCosts;
            const estimatedTax = grossProfit * taxRate;

            return {
                success: true,
                year,
                total_revenue: parseFloat(totalRevenue.toFixed(2)),
                total_costs: parseFloat(totalCosts.toFixed(2)),
                total_etsy_fees: parseFloat(totalFees.toFixed(2)),
                gross_profit: parseFloat(grossProfit.toFixed(2)),
                tax_rate: (taxRate * 100),
                estimated_tax: parseFloat(estimatedTax.toFixed(2)),
                net_profit: parseFloat((grossProfit - estimatedTax).toFixed(2)),
                units_sold: totalUnits,
                quarterly_breakdown: quarterlyBreakdown
            };
        } catch (error) {
            console.error('❌ Error calculating yearly tax:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get total fees for month
     */
    getFeesForMonth(year, month) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    SUM(amount) as total,
                    fee_type,
                    COUNT(*) as count
                FROM Etsy_Fees 
                WHERE strftime('%Y', charged_date) = ? 
                AND strftime('%m', charged_date) = ?
                GROUP BY fee_type
            `);
            
            const fees = stmt.all(
                year.toString().padStart(4, '0'),
                month.toString().padStart(2, '0')
            );

            const total = fees.reduce((sum, f) => sum + (f.total || 0), 0);

            return {
                total: parseFloat(total.toFixed(2)),
                breakdown: fees
            };
        } catch (error) {
            console.error('❌ Error getting fees for month:', error);
            return { total: 0, breakdown: [] };
        }
    }

    /**
     * Cache monthly report for performance
     */
    cacheMonthlyReport(year, month, metrics, tax, taxRate) {
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO Monthly_Reports 
                (year, month, total_revenue, total_material_costs, total_etsy_fees, 
                 total_net_profit, total_units_sold, tax_estimate, tax_rate, updated_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);

            stmt.run(
                year,
                month,
                metrics.total_revenue,
                metrics.total_costs,
                0, // TODO: get from Etsy_Fees
                metrics.total_profit - tax,
                metrics.units_sold,
                tax,
                taxRate
            );

            return { success: true };
        } catch (error) {
            console.error('❌ Error caching monthly report:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get cached report
     */
    getCachedReport(year, month) {
        try {
            const stmt = db.prepare(`
                SELECT * FROM Monthly_Reports 
                WHERE year = ? AND month = ?
            `);
            return stmt.get(year, month);
        } catch (error) {
            console.error('❌ Error getting cached report:', error);
            return null;
        }
    }

    /**
     * Generate tax payment schedule
     */
    getTaxPaymentSchedule(year) {
        try {
            const schedule = [];
            
            // Q1: April 15
            schedule.push({
                quarter: 1,
                due_date: `${year}-04-15`,
                amount: this.calculateQuarterlyTax(year, 1).estimated_tax,
                description: 'Q1 Estimated Tax Payment'
            });

            // Q2: June 15
            schedule.push({
                quarter: 2,
                due_date: `${year}-06-15`,
                amount: this.calculateQuarterlyTax(year, 2).estimated_tax,
                description: 'Q2 Estimated Tax Payment'
            });

            // Q3: September 15
            schedule.push({
                quarter: 3,
                due_date: `${year}-09-15`,
                amount: this.calculateQuarterlyTax(year, 3).estimated_tax,
                description: 'Q3 Estimated Tax Payment'
            });

            // Q4: January 15 (next year)
            schedule.push({
                quarter: 4,
                due_date: `${year + 1}-01-15`,
                amount: this.calculateQuarterlyTax(year, 4).estimated_tax,
                description: 'Q4 Estimated Tax Payment'
            });

            return {
                success: true,
                year,
                schedule,
                total_estimated_tax: schedule.reduce((sum, s) => sum + s.amount, 0)
            };
        } catch (error) {
            console.error('❌ Error generating tax schedule:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Log fee entry
     */
    logFee(orderId, feeType, amount, description = '') {
        try {
            const stmt = db.prepare(`
                INSERT INTO Etsy_Fees 
                (order_id, fee_type, amount, description, charged_date)
                VALUES (?, ?, ?, ?, datetime('now'))
            `);

            const result = stmt.run(orderId, feeType, amount, description);

            return {
                success: true,
                fee_id: result.lastInsertRowid,
                amount
            };
        } catch (error) {
            console.error('❌ Error logging fee:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all fees summary
     */
    getFeesSummary(year, month = null) {
        try {
            let query = `
                SELECT 
                    fee_type,
                    SUM(amount) as total,
                    COUNT(*) as count,
                    AVG(amount) as average
                FROM Etsy_Fees 
                WHERE strftime('%Y', charged_date) = ?
            `;
            
            const params = [year.toString().padStart(4, '0')];

            if (month) {
                query += ` AND strftime('%m', charged_date) = ?`;
                params.push(month.toString().padStart(2, '0'));
            }

            query += ` GROUP BY fee_type ORDER BY total DESC`;

            const stmt = db.prepare(query);
            return stmt.all(...params);
        } catch (error) {
            console.error('❌ Error getting fees summary:', error);
            return [];
        }
    }
}

export default new TaxReportService();
