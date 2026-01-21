/**
 * Sales & Tax Analytics Dashboard
 * Fetches and displays sales metrics, profitability, and tax data
 */

const API_BASE = '/api';

// Date range state - default to this month
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

let dateRangeState = {
    fromDate: firstDayOfMonth,
    toDate: lastDayOfMonth,
    currentPreset: 'thisMonth'
};

let currentTaxRate = 0.20;

// Persistence keys
const STORAGE_KEY_RANGE = 'salesAnalyticsDateRange';
const URL_PARAM_FROM = 'from';
const URL_PARAM_TO = 'to';
const URL_PARAM_PRESET = 'preset';

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function parseISODate(value) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

// Persist date range to localStorage and URL (bookmark/share friendly)
function persistDateRange({ from, to, preset }) {
    try {
        localStorage.setItem(STORAGE_KEY_RANGE, JSON.stringify({ from, to, preset }));
    } catch {}

    const params = new URLSearchParams(window.location.search);
    params.set(URL_PARAM_FROM, from);
    params.set(URL_PARAM_TO, to);
    params.set(URL_PARAM_PRESET, preset || 'custom');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Load saved range from URL (highest priority) or localStorage; fallback to this month
function loadSavedDateRange() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get(URL_PARAM_FROM);
    const toParam = params.get(URL_PARAM_TO);
    const presetParam = params.get(URL_PARAM_PRESET) || 'custom';

    const local = (() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_RANGE) || 'null');
        } catch {
            return null;
        }
    })();

    const from = parseISODate(fromParam) || parseISODate(local?.from) || firstDayOfMonth;
    const to = parseISODate(toParam) || parseISODate(local?.to) || lastDayOfMonth;
    const preset = fromParam && toParam ? presetParam : (local?.preset || 'thisMonth');

    return { from, to, preset };
}

function applyDateRangeToInputs(from, to, preset = 'custom') {
    document.getElementById('fromDateInput').value = formatDate(from);
    document.getElementById('toDateInput').value = formatDate(to);
    dateRangeState.fromDate = from;
    dateRangeState.toDate = to;
    dateRangeState.currentPreset = preset;
    persistDateRange({ from: formatDate(from), to: formatDate(to), preset });
}

// Fetch fees breakdown by category (Etsy-style Activity Summary)
async function fetchFeesByCategory(startDate, endDate) {
    try {
        const res = await fetch(`${API_BASE}/sales/by-category?startDate=${startDate}&endDate=${endDate}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                return data;
            }
        }
    } catch (err) {
        console.error('Error fetching fees by category:', err);
    }
    return {
        sales: 0,
        sales_credits: 0,
        fees: { listing: 0, transaction: 0, processing: 0, regulatory: 0, vat: 0 },
        marketing: { etsy_ads: 0, etsyAdsCredits: 0, offsite_ads: 0, offsiteAdsCredits: 0, orphanCredits: [] },
        delivery: { postage: 0 }
    };
}

function computeSummaryTotals(metrics, feesByCategory, taxRate) {
    const netRevenue = metrics.metrics?.net_revenue || 0;
    const supplierCost = metrics.metrics?.total_cost || 0;

    const netListingFees = (feesByCategory.fees?.listing || 0) - (feesByCategory.fees?.listingCredits || 0);
    const netTransactionFees = (feesByCategory.fees?.transaction || 0) - (feesByCategory.fees?.transactionCredits || 0);
    const netProcessingFees = (feesByCategory.fees?.processing || 0) - (feesByCategory.fees?.processingCredits || 0);
    const netRegulatoryFees = (feesByCategory.fees?.regulatory || 0) - (feesByCategory.fees?.regulatoryCredits || 0);
    const netVatFees = (feesByCategory.fees?.vat || 0) - (feesByCategory.fees?.vatCredits || 0);
    const miscCredits = feesByCategory.fees?.miscCredit || 0;

    const netEtsyFees = netListingFees + netTransactionFees + netProcessingFees + netRegulatoryFees + netVatFees - miscCredits;

    const netEtsyAds = (feesByCategory.marketing?.etsy_ads || 0) - (feesByCategory.marketing?.etsyAdsCredits || 0);
    const netOffsiteAds = (feesByCategory.marketing?.offsite_ads || 0) - (feesByCategory.marketing?.offsiteAdsCredits || 0);
    const netMarketing = netEtsyAds + netOffsiteAds;

    const netDelivery = (feesByCategory.delivery?.postage || 0) - (feesByCategory.delivery?.postageCredits || 0);

    const grossAfterFees = netRevenue - netEtsyFees - netMarketing - netDelivery;
    const netProfit = grossAfterFees - supplierCost;
    const estimatedTax = Math.max(0, netProfit * (taxRate ?? currentTaxRate ?? 0));
    const netProfitAfterTax = netProfit - estimatedTax;
    const profitMarginPercent = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
        netRevenue,
        supplierCost,
        netEtsyFees,
        netMarketing,
        netDelivery,
        grossAfterFees,
        netProfit,
        estimatedTax,
        netProfitAfterTax,
        profitMarginPercent
    };
}

async function loadAnalytics() {
    const from = document.getElementById('fromDateInput')?.value || dateRangeState.fromDate.toISOString().split('T')[0];
    const to = document.getElementById('toDateInput')?.value || dateRangeState.toDate.toISOString().split('T')[0];
    const taxRate = parseInt(document.getElementById('taxRateInput').value) / 100 || 0.20;
    currentTaxRate = taxRate;

    // Debug logging to verify correct date range
    console.log(`📊 Loading analytics for: ${from} to ${to}`);
    
    dateRangeState.fromDate = new Date(from);
    dateRangeState.toDate = new Date(to);

    try {
        // Fetch sales by date range (used for tables and context)
        const salesRes = await fetch(`${API_BASE}/sales/range?startDate=${from}&endDate=${to}`);
        if (!salesRes.ok) throw new Error(`Sales API error: ${salesRes.status}`);
        const salesData = await salesRes.json();
        if (!salesData.success) throw new Error(salesData.error || 'Failed to fetch sales');

        // Fetch shop-level fees (Marketing, VAT, Postage, etc.) that don't link to specific orders
        let shopLevelFees = 0;
        const feesRes = await fetch(`${API_BASE}/sales/shop-level?startDate=${from}&endDate=${to}`);
        if (feesRes.ok) {
            const feesData = await feesRes.json();
            if (feesData.success) {
                shopLevelFees = feesData.total || 0;
                window.shopLevelFeesTotal = shopLevelFees;
            }
        }

        // Fetch fees breakdown by category (Etsy-style)
        const feesByCategory = await fetchFeesByCategory(from, to);

        // Fetch metrics from backend (server-side calculations)
        const metricsRes = await fetch(`${API_BASE}/sales/metrics?startDate=${from}&endDate=${to}&taxRate=${taxRate}&shopLevelFees=${shopLevelFees}`);
        if (!metricsRes.ok) throw new Error(`Metrics API error: ${metricsRes.status}`);
        const metricsPayload = await metricsRes.json();
        if (!metricsPayload.success) throw new Error(metricsPayload.error || 'Failed to fetch metrics');
        const metrics = { metrics: metricsPayload.metrics };

        // Fetch profitability from backend
        let profitData = [];
        const profitRes = await fetch(`${API_BASE}/sales/profitability?startDate=${from}&endDate=${to}`);
        if (profitRes.ok) {
            const profitJson = await profitRes.json();
            if (profitJson.success) {
                profitData = profitJson.data || [];
            }
        }

        // Update Etsy-style activity summary with fee breakdown
        updateActivitySummary(salesData.data || [], metrics, feesByCategory, taxRate);

        // Update headline metrics (recomputed with fees breakdown)
        updateMetrics(metrics, feesByCategory, taxRate);

        // Update sales table
        updateSalesTable(salesData.data || []);

        // Update profitability and top products using backend data
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

function updateMetrics(metrics, feesByCategory = {}, taxRate = currentTaxRate) {
    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    const formatPercent = (val) => (val || 0).toFixed(1) + '%';

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = val;
    };

    const summary = computeSummaryTotals(metrics, feesByCategory, taxRate);

    // Show gross revenue (before refunds) as main figure
    setText('totalRevenue', formatCurrency(metrics.metrics.total_revenue));
    
    // If there are refunds, show them (you can add this to HTML later)
    if (metrics.metrics.total_refunds > 0) {
        setText('totalRefunds', formatCurrency(metrics.metrics.total_refunds));
    }
    
    // Show net costs (after refunds returned)
    setText('totalSupplierCosts', formatCurrency(summary.supplierCost));
    // totalFees element is optional; only set if present
    setText('totalFees', formatCurrency(summary.netEtsyFees));
    setText('grossProfit', formatCurrency(summary.grossAfterFees));
    setText('netProfitBox', formatCurrency(summary.netProfit));
    setText('estimatedTax', formatCurrency(summary.estimatedTax));
    setText('profitMargin', formatPercent(summary.profitMarginPercent));

    // Sales stats
    setText('unitsSold', metrics.metrics.units_sold);
    setText('avgOrderValue', formatCurrency(metrics.metrics.average_order_value));
    setText('orderCount', Math.ceil(metrics.metrics.total_revenue / (metrics.metrics.average_order_value || 1)) || 0);

    // Tax stats
    setText('taxRevenue', formatCurrency(summary.netRevenue));
    setText('taxCosts', formatCurrency(summary.supplierCost));
    setText('etsyFees', formatCurrency(summary.netEtsyFees + summary.netMarketing + summary.netDelivery));
    setText('netProfit', formatCurrency(summary.netProfitAfterTax));
}

function updateActivitySummary(sales, metrics, feesByCategory, taxRate = currentTaxRate) {
    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(Math.abs(val) || 0);

    // Use actual tax paid by customer from database (tax_amount field)
    const totalRevenue = metrics.metrics.total_revenue || 0;
    const netRevenue = metrics.metrics.net_revenue || 0;
    const salesTaxPaidByBuyer = metrics.metrics.sales_tax_paid_by_customer || 0;

    // Sales box - use data from feesByCategory API (which matches Etsy's reporting)
    // Etsy shows net sales (excluding tax and refunds)
    document.getElementById('totalRevenueBox').textContent = formatCurrency(feesByCategory.sales || netRevenue);
    document.getElementById('salesTotalSales').textContent = formatCurrency(feesByCategory.total_sales || totalRevenue);
    // Use feesByCategory for refunds (can be 0), only fallback to metrics if undefined
    document.getElementById('salesTotalRefunds').textContent = formatCurrency(feesByCategory.total_refunds !== undefined ? feesByCategory.total_refunds : metrics.metrics.total_refunds);
    // Show tax from sales in this period only (not refunded tax)
    const netSalesTax = (feesByCategory.total_tax || 0);
    document.getElementById('salesTaxPaidByBuyer').textContent = netSalesTax > 0 ? formatCurrency(netSalesTax) : '--';
    document.getElementById('salesCredits').textContent = formatCurrency(feesByCategory.sales_credits || 0);
    document.getElementById('vatPaidByBuyer').textContent = '--';

    // Fees box - calculate net totals (fees minus credits)
    const netListingFees = (feesByCategory.fees?.listing || 0) - (feesByCategory.fees?.listingCredits || 0);
    const netTransactionFees = (feesByCategory.fees?.transaction || 0) - (feesByCategory.fees?.transactionCredits || 0);
    const netProcessingFees = (feesByCategory.fees?.processing || 0) - (feesByCategory.fees?.processingCredits || 0);
    const netRegulatoryFees = (feesByCategory.fees?.regulatory || 0) - (feesByCategory.fees?.regulatoryCredits || 0);
    const netVatFees = (feesByCategory.fees?.vat || 0) - (feesByCategory.fees?.vatCredits || 0);
    
    // Misc credits reduce the net fee position (they're credits in the Fees section)
    const miscCredits = feesByCategory.fees?.miscCredit || 0;
    
    const totalFees = netListingFees + netTransactionFees + netProcessingFees + netRegulatoryFees + netVatFees - miscCredits;
    
    // Display fees total - if negative (credit), show in green without minus. If positive (fee), show in red with minus
    const feesBox = document.getElementById('totalFeesBox');
    if (totalFees < 0) {
        // Credit to seller - show in green, positive value
        feesBox.textContent = formatCurrency(Math.abs(totalFees));
        feesBox.style.color = '#28a745';  // Green for credit
    } else {
        // Fee to seller - show in red with minus sign
        feesBox.textContent = '-' + formatCurrency(totalFees);
        feesBox.style.color = '#dc3545';  // Red for fees
    }
    
    // Show fees with credits displayed separately (Etsy style)
    const formatFeeWithCredit = (feeAmount, creditAmount, elementId) => {
        const element = document.getElementById(elementId);
        if (creditAmount > 0) {
            element.innerHTML = `${formatCurrency(feeAmount)}<br><small style="color: #28a745;">Credits: ${formatCurrency(creditAmount)}</small>`;
        } else {
            element.textContent = formatCurrency(feeAmount);
        }
    };
    
    formatFeeWithCredit(feesByCategory.fees?.listing || 0, feesByCategory.fees?.listingCredits || 0, 'feesListing');
    formatFeeWithCredit(feesByCategory.fees?.transaction || 0, feesByCategory.fees?.transactionCredits || 0, 'feesTransaction');
    formatFeeWithCredit(feesByCategory.fees?.processing || 0, feesByCategory.fees?.processingCredits || 0, 'feesProcessing');
    formatFeeWithCredit(feesByCategory.fees?.regulatory || 0, feesByCategory.fees?.regulatoryCredits || 0, 'feesRegulatory');
    formatFeeWithCredit(feesByCategory.fees?.vat || 0, feesByCategory.fees?.vatCredits || 0, 'feesVat');
    
    // Display Misc. Etsy credits (shown in green as a credit/reduction)
    const miscCreditsDisplay = feesByCategory.fees?.miscCredit || 0;
    document.getElementById('feesMiscCredit').textContent = formatCurrency(miscCreditsDisplay);

    // Marketing box - Etsy shows gross totals (no credit deduction at summary level)
    const netEtsyAds = (feesByCategory.marketing?.etsy_ads || 0) - (feesByCategory.marketing?.etsyAdsCredits || 0);
    const netOffsiteAds = (feesByCategory.marketing?.offsite_ads || 0) - (feesByCategory.marketing?.offsiteAdsCredits || 0);
    // Total marketing should reflect charges minus credits (net)
    const totalMarketing = netEtsyAds + netOffsiteAds;
    
    // Display marketing total - if negative (credit), show in green. If positive (cost), show in red with minus
    const marketingBox = document.getElementById('totalMarketingBox');
    if (totalMarketing < 0) {
        marketingBox.textContent = formatCurrency(Math.abs(totalMarketing));
        marketingBox.style.color = '#28a745';  // Green for credit
    } else {
        marketingBox.textContent = '-' + formatCurrency(totalMarketing);
        marketingBox.style.color = '#dc3545';  // Red for fees
    }
    // Show net amounts for individual items
    document.getElementById('marketingEtsyAds').textContent = formatCurrency(netEtsyAds);
    document.getElementById('marketingOffsiteAds').textContent = formatCurrency(netOffsiteAds);
    const totalCredits = (feesByCategory.marketing?.etsyAdsCredits || 0) + (feesByCategory.marketing?.offsiteAdsCredits || 0);
    document.getElementById('marketingCredits').textContent = formatCurrency(totalCredits);

    // Surface orphan marketing credits (not tied to orders) for manual reconciliation
    const orphanContainer = document.getElementById('marketingOrphanContainer');
    const orphanList = document.getElementById('marketingOrphanList');
    const orphanCredits = feesByCategory.marketing?.orphanCredits || [];

    if (orphanCredits.length > 0) {
        orphanContainer.style.display = 'block';
        orphanList.innerHTML = orphanCredits.map(row => {
            const dateStr = new Date(row.charged_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
            return `<li>${dateStr} — ${row.description || row.fee_type} (credit ${formatCurrency(row.credit || 0)})</li>`;
        }).join('');
    } else {
        orphanContainer.style.display = 'none';
        orphanList.innerHTML = '';
    }

    // Delivery box - show net amount only (no credit breakdown)
    const netDelivery = (feesByCategory.delivery?.postage || 0) - (feesByCategory.delivery?.postageCredits || 0);
    
    // Display delivery total - if negative (credit), show in green. If positive (cost), show in red with minus
    const deliveryBox = document.getElementById('totalDeliveryBox');
    if (netDelivery < 0) {
        deliveryBox.textContent = formatCurrency(Math.abs(netDelivery));
        deliveryBox.style.color = '#28a745';  // Green for credit
    } else {
        deliveryBox.textContent = '-' + formatCurrency(netDelivery);
        deliveryBox.style.color = '#dc3545';  // Red for fees
    }
    document.getElementById('deliveryPostage').textContent = formatCurrency(netDelivery);

    // Summary metrics (reuse computation so cards match activity breakdown)
    const summary = computeSummaryTotals(metrics, feesByCategory, taxRate);
    document.getElementById('totalSupplierCosts').textContent = formatCurrency(summary.supplierCost);
    document.getElementById('grossProfit').textContent = formatCurrency(summary.grossAfterFees);
    document.getElementById('netProfitBox').textContent = formatCurrency(summary.netProfit);
    document.getElementById('estimatedTax').textContent = formatCurrency(summary.estimatedTax);
    document.getElementById('profitMargin').textContent = summary.profitMarginPercent.toFixed(1) + '%';
}

function updateSalesTable(sales) {
    const tbody = document.getElementById('salesTable');
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No sales found</td></tr>';
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
            <td>${formatCurrency(sale.tax_amount || 0)}</td>
            <td>${formatCurrency(sale.material_cost_at_sale || 0)}</td>
            <td>${formatCurrency((sale.sale_price || 0) - (sale.tax_amount || 0) - (sale.material_cost_at_sale || 0))}</td>
            <td><span class="status-badge status-paid">${sale.status || 'Complete'}</span></td>
        </tr>
    `).join('');
}

function updateProfitTable(profitData) {
    const tbody = document.getElementById('profitTable');
    
    if (profitData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No product profitability data</td></tr>';
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(val || 0);

    tbody.innerHTML = profitData.map(product => {
        const margin = product.total_revenue > 0 ? ((product.total_profit / product.total_revenue) * 100).toFixed(1) : 0;
        return `
            <tr>
                <td>${product.sku || 'N/A'}</td>
                <td>${product.product_name || 'N/A'}</td>
                <td>${product.quantity}</td>
                <td>${formatCurrency(product.total_revenue)}</td>
                <td>${formatCurrency(product.total_cost)}</td>
                <td>${formatCurrency(product.total_fees)}</td>
                <td>${formatCurrency(product.total_profit)}</td>
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
            <td>${product.units_sold || product.quantity || 0}</td>
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
    const from = new Date(document.getElementById('fromDateInput').value);
    const to = new Date(document.getElementById('toDateInput').value);
    applyDateRangeToInputs(from, to, 'custom');
    loadAnalytics();
}

function updateMonthYear() {
    const monthStr = document.getElementById('monthSelect').value;
    const yearStr = document.getElementById('yearSelect').value;
    
    // Only proceed if both month and year are selected
    if (!monthStr || !yearStr) {
        return;
    }
    
    // Parse with base 10 to avoid octal interpretation of "08", "09"
    const monthNum = parseInt(monthStr, 10);
    const yearNum = parseInt(yearStr, 10);
    
    // Create date range for the selected month
    // Month is 1-based in the select (01-12), but Date constructor uses 0-based (0-11)
    // Create at noon to avoid timezone boundary issues
    const from = new Date(yearNum, monthNum - 1, 1, 12, 0, 0);  // First day of month
    const to = new Date(yearNum, monthNum, 0, 12, 0, 0);  // Last day of month (day 0 of next month)
    
    // Set the date inputs
    document.getElementById('fromDateInput').value = from.toISOString().split('T')[0];
    document.getElementById('toDateInput').value = to.toISOString().split('T')[0];
    
    // Apply the dates
    closeDatePicker();
    updateDateRangeDisplay();
    applyDateRangeToInputs(from, to, `${yearStr}-${monthStr}`);
    loadAnalytics();
}

function applyPreset(preset, evt) {
    const today = new Date();
    let from, to;
    
    // Set end of range to end of today for all presets
    to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
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
            break;
        default:
            return;
    }
    
    document.getElementById('fromDateInput').value = from.toISOString().split('T')[0];
    document.getElementById('toDateInput').value = to.toISOString().split('T')[0];
    
    // Update preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    if (evt?.target) {
        evt.target.classList.add('active');
    }
    
    dateRangeState.currentPreset = preset;
    persistDateRange({ from: formatDate(from), to: formatDate(to), preset });
    updateDateRangeDisplay();
    loadAnalytics();
}

// Load analytics on page load
document.addEventListener('DOMContentLoaded', () => {
    const saved = loadSavedDateRange();
    applyDateRangeToInputs(saved.from, saved.to, saved.preset);
    updateDateRangeDisplay();
    loadAnalytics();
    
    // Close modal on outside click
    document.getElementById('datePickerModal').addEventListener('click', (e) => {
        if (e.target.id === 'datePickerModal') {
            closeDatePicker();
        }
    });
});

// Update dates when page regains focus (like Grafana)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Keep current selection; just refresh data
        updateDateRangeDisplay();
        loadAnalytics();
    }
});
