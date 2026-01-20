/**
 * Sales & Tax Analytics Dashboard
 * Fetches and displays sales metrics, profitability, and tax data
 */

const API_BASE = '/api';

// Date range state
let dateRangeState = {
    fromDate: new Date('2025-04-01'),
    toDate: new Date('2026-01-19'),
    currentPreset: 'thisMonth'
};

async function loadAnalytics() {
    const from = document.getElementById('fromDateInput')?.value || dateRangeState.fromDate.toISOString().split('T')[0];
    const to = document.getElementById('toDateInput')?.value || dateRangeState.toDate.toISOString().split('T')[0];
    const taxRate = parseInt(document.getElementById('taxRateInput').value) / 100 || 0.25;

    dateRangeState.fromDate = new Date(from);
    dateRangeState.toDate = new Date(to);

    try {
        // Fetch sales by date range
        const salesRes = await fetch(`${API_BASE}/sales/range?startDate=${from}&endDate=${to}`);
        if (!salesRes.ok) throw new Error(`Sales API error: ${salesRes.status}`);
        const salesData = await salesRes.json();
        
        if (!salesData.success) throw new Error(salesData.error || 'Failed to fetch sales');

        // Calculate metrics from date range
        const metrics = calculateMetricsFromSales(salesData.data || [], taxRate);

        // Update key metrics
        updateMetrics(metrics);

        // Update sales table
        updateSalesTable(salesData.data || []);

        // Calculate profitability and top products from sales
        const profitData = calculateProfitabilityFromSales(salesData.data || []);
        updateProfitTable(profitData);
        updateTopProductsTable(profitData);

        // Update tax report using calculated metrics
        updateTaxReport(metrics);

        // Update fees using calculated metrics
        updateFeesTable(metrics);

        updateDateRangeDisplay();

    } catch (error) {
        console.error('Error loading analytics:', error);
        showError('Failed to load analytics data');
    }
}

function calculateMetricsFromSales(sales, taxRate) {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalFees = 0;
    let unitsSold = 0;

    sales.forEach(sale => {
        totalRevenue += sale.sale_price || 0;
        totalCost += sale.material_cost_at_sale || 0;
        totalFees += sale.etsy_fees || 0;
        unitsSold += sale.quantity || 1;
    });

    const grossProfit = totalRevenue - totalCost;
    const netProfit = totalRevenue - totalCost - totalFees;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
    const estimatedTax = netProfit * taxRate;
    const netProfitAfterTax = netProfit - estimatedTax;

    return {
        metrics: {
            total_revenue: totalRevenue,
            gross_profit: grossProfit,
            total_profit: netProfit,
            total_cost: totalCost,
            total_fees: totalFees,
            units_sold: unitsSold,
            average_order_value: sales.length > 0 ? totalRevenue / sales.length : 0,
            profit_margin_percent: profitMargin,
            estimated_tax: estimatedTax,
            net_profit_after_tax: netProfitAfterTax
        }
    };
}

function calculateProfitabilityFromSales(sales) {
    const bySkus = {};

    sales.forEach(sale => {
        if (!bySkus[sale.sku]) {
            bySkus[sale.sku] = {
                sku: sale.sku,
                product_name: sale.product_name,
                quantity: 0,
                total_revenue: 0,
                total_cost: 0,
                total_profit: 0
            };
        }

        bySkus[sale.sku].quantity += sale.quantity || 1;
        bySkus[sale.sku].total_revenue += sale.sale_price || 0;
        bySkus[sale.sku].total_cost += sale.material_cost_at_sale || 0;
        bySkus[sale.sku].total_profit = bySkus[sale.sku].total_revenue - bySkus[sale.sku].total_cost;
    });

    return Object.values(bySkus).sort((a, b) => b.total_profit - a.total_profit);
}

function updateMetrics(metrics) {
    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    const formatPercent = (val) => (val || 0).toFixed(1) + '%';

    document.getElementById('totalRevenue').textContent = formatCurrency(metrics.metrics.total_revenue);
    document.getElementById('grossProfit').textContent = formatCurrency(metrics.metrics.gross_profit);
    document.getElementById('estimatedTax').textContent = formatCurrency(metrics.metrics.estimated_tax);
    document.getElementById('profitMargin').textContent = formatPercent(metrics.metrics.profit_margin_percent);

    // Sales stats
    document.getElementById('unitsSold').textContent = metrics.metrics.units_sold;
    document.getElementById('avgOrderValue').textContent = formatCurrency(metrics.metrics.average_order_value);
    document.getElementById('orderCount').textContent = Math.ceil(metrics.metrics.total_revenue / (metrics.metrics.average_order_value || 1)) || 0;

    // Tax stats
    document.getElementById('taxRevenue').textContent = formatCurrency(metrics.metrics.total_revenue);
    document.getElementById('taxCosts').textContent = formatCurrency(metrics.metrics.total_cost);
    document.getElementById('etsyFees').textContent = formatCurrency(metrics.metrics.total_fees);
    document.getElementById('netProfit').textContent = formatCurrency(metrics.metrics.net_profit_after_tax);
}

function updateSalesTable(sales) {
    const tbody = document.getElementById('salesTable');
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No sales found</td></tr>';
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td>${sale.order_id}</td>
            <td>${sale.product_name || 'N/A'}</td>
            <td>${sale.quantity}</td>
            <td>${formatCurrency(sale.sale_price)}</td>
            <td>${formatCurrency(sale.material_cost_at_sale || 0)}</td>
            <td>${formatCurrency((sale.sale_price || 0) - (sale.material_cost_at_sale || 0))}</td>
            <td><span class="status-badge status-paid">${sale.status || 'paid'}</span></td>
        </tr>
    `).join('');
}

function updateProfitTable(profitData) {
    const tbody = document.getElementById('profitTable');
    
    if (profitData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No product profitability data</td></tr>';
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    tbody.innerHTML = profitData.map(product => {
        const margin = product.total_revenue > 0 ? ((product.profit / product.total_revenue) * 100).toFixed(1) : 0;
        return `
            <tr>
                <td>${product.sku || 'N/A'}</td>
                <td>${product.product_name || 'N/A'}</td>
                <td>${product.total_quantity}</td>
                <td>${formatCurrency(product.total_revenue)}</td>
                <td>${formatCurrency(product.total_costs)}</td>
                <td>${formatCurrency(product.profit)}</td>
                <td>${margin}%</td>
            </tr>
        `;
    }).join('');
}

function updateTopProductsTable(topProducts) {
    const tbody = document.getElementById('topProductsTable');
    
    if (topProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No sales data</td></tr>';
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    tbody.innerHTML = topProducts.map((product, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${product.product_name || 'N/A'}</td>
            <td>${product.units_sold}</td>
            <td>${formatCurrency(product.total_revenue)}</td>
        </tr>
    `).join('');
}

function updateTaxReport(metrics) {
    const tbody = document.getElementById('taxScheduleTable');
    
    // Generate simple quarterly schedule for current year
    const year = new Date().getFullYear();
    const schedule = [
        { quarter: 1, due_date: `31 Jan ${year + 1}` },
        { quarter: 2, due_date: `31 Jul ${year}` },
        { quarter: 3, due_date: `31 Oct ${year}` },
        { quarter: 4, due_date: `31 Jan ${year + 1}` }
    ];
    
    tbody.innerHTML = schedule.map(quarter => `
        <tr>
            <td>Q${quarter.quarter}</td>
            <td>${quarter.due_date}</td>
        </tr>
    `).join('');
}

function updateFeesTable(metrics) {
    const tbody = document.getElementById('feesTable');
    const totalFees = metrics.metrics.total_fees;
    const totalRevenue = metrics.metrics.total_revenue;

    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    const percent = totalRevenue > 0 ? ((totalFees / totalRevenue) * 100).toFixed(2) : 0;
    
    tbody.innerHTML = `
        <tr>
            <td>Transaction Fees</td>
            <td>${formatCurrency(totalFees)}</td>
            <td>${percent}%</td>
        </tr>
    `;

    document.getElementById('annualFees').textContent = formatCurrency(totalFees);
    
    // Calculate average fee per order
    const orderCount = metrics.metrics.units_sold;
    const avgFee = orderCount > 0 ? totalFees / orderCount : 0;
    document.getElementById('avgFeePerOrder').textContent = formatCurrency(avgFee);
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Deactivate all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Activate button
    event.target.classList.add('active');
}

async function syncEtsy() {
    if (!confirm('Sync orders from Etsy? This will fetch your recent orders.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/sales/sync?days=30`);
        const result = await response.json();

        if (result.success) {
            showSuccess(`✅ Synced ${result.synced} orders from Etsy`);
            // Reload analytics
            setTimeout(() => loadAnalytics(), 1000);
        } else {
            showError(`❌ Sync failed: ${result.error}`);
        }
    } catch (error) {
        showError('Failed to sync Etsy orders');
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.querySelector('.welcome-section').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.querySelector('.welcome-section').appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
}

function previousMonth() {
    let month = parseInt(document.getElementById('monthSelect').value);
    let year = parseInt(document.getElementById('yearSelect').value);
    
    month--;
    if (month < 1) {
        month = 12;
        year--;
    }
    
    document.getElementById('monthSelect').value = month;
    document.getElementById('yearSelect').value = year;
    loadAnalytics();
}

function nextMonth() {
    let month = parseInt(document.getElementById('monthSelect').value);
    let year = parseInt(document.getElementById('yearSelect').value);
    
    month++;
    if (month > 12) {
        month = 1;
        year++;
    }
    
    document.getElementById('monthSelect').value = month;
    document.getElementById('yearSelect').value = year;
    loadAnalytics();
}

// Date Picker Functions (Grafana-style)
function openDatePicker() {
    document.getElementById('datePickerModal').classList.add('active');
}

function closeDatePicker() {
    document.getElementById('datePickerModal').classList.remove('active');
}

function updateDateRangeDisplay() {
    const from = new Date(document.getElementById('fromDateInput').value);
    const to = new Date(document.getElementById('toDateInput').value);
    
    const fromStr = from.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    const toStr = to.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    
    document.getElementById('dateRangeDisplay').textContent = `${fromStr} to ${toStr}`;
}

function applyDateRange() {
    closeDatePicker();
    updateDateRangeDisplay();
    loadAnalytics();
}

function applyPreset(preset) {
    const today = new Date();
    let from, to;
    
    to = new Date(today);
    
    switch(preset) {
        case 'thisMonth':
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'last30':
            from = new Date(today);
            from.setDate(from.getDate() - 30);
            break;
        case 'thisYear':
            from = new Date(today.getFullYear(), 3, 1); // April (financial year start)
            break;
        case 'allTime':
            from = new Date('2025-04-01');
            to = new Date('2026-01-19');
            break;
        default:
            return;
    }
    
    document.getElementById('fromDateInput').value = from.toISOString().split('T')[0];
    document.getElementById('toDateInput').value = to.toISOString().split('T')[0];
    
    // Update preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    dateRangeState.currentPreset = preset;
    updateDateRangeDisplay();
    loadAnalytics();
}

// Load analytics on page load
document.addEventListener('DOMContentLoaded', () => {
    // Default to all data
    document.getElementById('fromDateInput').value = '2025-04-01';
    document.getElementById('toDateInput').value = '2026-01-19';
    updateDateRangeDisplay();
    loadAnalytics();
    
    // Close modal on outside click
    document.getElementById('datePickerModal').addEventListener('click', (e) => {
        if (e.target.id === 'datePickerModal') {
            closeDatePicker();
        }
    });
});
