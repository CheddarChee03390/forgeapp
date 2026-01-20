// Pricing Manager UI Logic
let allPrices = [];
let selectedSkus = new Set();
let previousMargins = new Map(); // Track previous margin values for each SKU
let sortColumn = null;
let sortDirection = 'asc';

// DOM Elements
const btnCalculate = document.getElementById('btnCalculate');
const btnApproveSelected = document.getElementById('btnApproveSelected');
const btnRejectSelected = document.getElementById('btnRejectSelected');
const btnPushSelected = document.getElementById('btnPushSelected');
const btnApplyMargin = document.getElementById('btnApplyMargin');
const bulkMarginInput = document.getElementById('bulkMargin');
const btnReset = document.getElementById('btnReset');
const filterStatus = document.getElementById('filterStatus');
const searchInput = document.getElementById('searchInput');
const selectAll = document.getElementById('selectAll');
const pricingTableBody = document.getElementById('pricingTableBody');
const selectedCount = document.getElementById('selectedCount');

// Event Listeners
btnCalculate.addEventListener('click', calculatePrices);
btnApproveSelected.addEventListener('click', approveSelected);
btnRejectSelected.addEventListener('click', rejectSelected);
btnPushSelected.addEventListener('click', pushSelected);
btnApplyMargin.addEventListener('click', applyBulkMargin);
btnReset.addEventListener('click', resetFilters);
filterStatus.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);
selectAll.addEventListener('change', toggleSelectAll);

// Sortable column headers
document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', (e) => {
        const column = e.target.dataset.sort;
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
        
        // Update header indicators
        document.querySelectorAll('.sortable').forEach(h => {
            h.textContent = h.textContent.replace(/[▸▴▾]/g, '').trim() + ' ▸';
        });
        e.target.textContent = e.target.textContent.replace(/[▸▴▾]/g, '').trim() + (sortDirection === 'asc' ? ' ▴' : ' ▾');
        
        applyFilters();
    });
});

// Column visibility toggles
document.querySelectorAll('.col-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
        const colIndex = e.target.dataset.col;
        const isVisible = e.target.checked;
        const style = document.getElementById('col-style-' + colIndex) || document.createElement('style');
        style.id = 'col-style-' + colIndex;
        
        if (!isVisible) {
            style.textContent = `.pricing-table th:nth-child(${colIndex}), .pricing-table td:nth-child(${colIndex}) { display: none; }`;
            if (!document.getElementById(style.id)) {
                document.head.appendChild(style);
            }
        } else {
            style.textContent = '';
        }
    });
});

// Handle scroll shadow indicator
const tableScroll = document.querySelector('.table-scroll');
if (tableScroll) {
    function updateScrollShadow() {
        const hasScroll = tableScroll.scrollWidth > tableScroll.clientWidth;
        const isScrolledToEnd = tableScroll.scrollLeft >= (tableScroll.scrollWidth - tableScroll.clientWidth - 5);
        
        if (hasScroll && !isScrolledToEnd) {
            tableScroll.classList.add('has-scroll');
        } else {
            tableScroll.classList.remove('has-scroll');
        }
    }
    
    tableScroll.addEventListener('scroll', updateScrollShadow);
    window.addEventListener('resize', updateScrollShadow);
    // Update after table renders
    setTimeout(updateScrollShadow, 100);
}

// Load data on page load
loadStats();
loadPrices();

async function calculatePrices() {
    btnCalculate.disabled = true;
    btnCalculate.textContent = '⏳ Calculating...';
    
    try {
        const response = await fetch('/api/pricing/calculate', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Calculated ${result.calculated} prices\nSkipped ${result.skipped} (no mapping/weight data)`);
            await loadStats();
            await loadPrices();
        } else {
            alert('Error calculating prices: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        btnCalculate.disabled = false;
        btnCalculate.textContent = '🔄 Calculate Prices';
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/pricing/stats');
        const stats = await response.json();
        
        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statListings').textContent = stats.listings || 0;
        document.getElementById('statPending').textContent = stats.pending || 0;
        document.getElementById('statApproved').textContent = stats.approved || 0;
        document.getElementById('statAvgMargin').textContent = stats.avg_margin 
            ? stats.avg_margin.toFixed(1) + '%' 
            : '0%';
        document.getElementById('statNegativeProfit').textContent = stats.negative_profit || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadPrices() {
    try {
        const response = await fetch('/api/pricing/staged');
        allPrices = await response.json();
        
        if (allPrices.length === 0) {
            pricingTableBody.innerHTML = '<tr><td colspan="18" class="empty">No pricing data. Click "Calculate Prices" to begin.</td></tr>';
            return;
        }
        
        applyFilters();
    } catch (error) {
        pricingTableBody.innerHTML = `<tr><td colspan="18" class="error">Error loading prices: ${error.message}</td></tr>`;
    }
}

function applyFilters() {
    const statusFilter = filterStatus.value;
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = allPrices;
    
    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.variation_sku.toLowerCase().includes(searchTerm) ||
            (p.listing_title && p.listing_title.toLowerCase().includes(searchTerm))
        );
    }
    
    // Sort if column is selected
    if (sortColumn) {
        filtered.sort((a, b) => {
            let aVal, bVal;
            
            switch(sortColumn) {
                case 'variation_sku':
                    aVal = a.variation_sku || '';
                    bVal = b.variation_sku || '';
                    return sortDirection === 'asc' 
                        ? aVal.localeCompare(bVal) 
                        : bVal.localeCompare(aVal);
                
                case 'margin_modifier':
                    aVal = a.margin_modifier || 0;
                    bVal = b.margin_modifier || 0;
                    break;
                    
                case 'current_price':
                    aVal = a.current_price || 0;
                    bVal = b.current_price || 0;
                    break;
                    
                case 'calculated_price':
                    aVal = a.calculated_price || 0;
                    bVal = b.calculated_price || 0;
                    break;
                    
                case 'material_cost':
                    aVal = a.material_cost || 0;
                    bVal = b.material_cost || 0;
                    break;
                    
                case 'profit':
                    // Calculate profit with ads for sorting
                    const priceA = a.calculated_price || 0;
                    const priceB = b.calculated_price || 0;
                    aVal = priceA - a.material_cost - (priceA * 0.255 + 0.2) - (a.postage_cost || 0);
                    bVal = priceB - b.material_cost - (priceB * 0.255 + 0.2) - (b.postage_cost || 0);
                    break;
                    
                case 'profit_margin':
                    // Calculate margin with ads for sorting
                    const pA = a.calculated_price || 0;
                    const pB = b.calculated_price || 0;
                    const profA = pA - a.material_cost - (pA * 0.255 + 0.2) - (a.postage_cost || 0);
                    const profB = pB - b.material_cost - (pB * 0.255 + 0.2) - (b.postage_cost || 0);
                    aVal = pA > 0 ? (profA / pA) * 100 : 0;
                    bVal = pB > 0 ? (profB / pB) * 100 : 0;
                    break;
                    
                case 'status':
                    aVal = a.status || '';
                    bVal = b.status || '';
                    return sortDirection === 'asc' 
                        ? aVal.localeCompare(bVal) 
                        : bVal.localeCompare(aVal);
                    
                default:
                    aVal = 0;
                    bVal = 0;
            }
            
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }
    
    renderTable(filtered);
    
    // Update scroll shadow after rendering
    setTimeout(() => {
        const tableScroll = document.querySelector('.table-scroll');
        if (tableScroll) {
            const event = new Event('scroll');
            tableScroll.dispatchEvent(event);
        }
    }, 50);
}

function renderTable(prices) {
    if (prices.length === 0) {
        pricingTableBody.innerHTML = '<tr><td colspan="18" class="empty">No prices match your filters.</td></tr>';
        return;
    }
    
    pricingTableBody.innerHTML = prices.map(p => {
        const statusClass = getStatusClass(p.status);
        const isChecked = selectedSkus.has(p.variation_sku) ? 'checked' : '';
        
        // Calculate modified price based on target margin
        const basePrice = p.base_calculated_price || p.calculated_price;
        let modifiedPrice;
        
        if (p.margin_modifier && p.margin_modifier > 0) {
            // Reverse calculate: what price gives us the target margin with ads?
            // Formula: Price = (MaterialCost + PaymentFeeFixed + Postage) / (FeeMultiplier - TargetMargin)
            // Where FeeMultiplier = 1 - 0.065 - 0.04 - 0.15 = 0.745
            const targetMargin = p.margin_modifier / 100;
            const feeMultiplier = 0.745; // 1 - transaction(6.5%) - payment(4%) - ad(15%)
            const fixedCosts = p.material_cost + 0.2 + (p.postage_cost || 0); // material + payment fixed fee + postage
            
            modifiedPrice = fixedCosts / (feeMultiplier - targetMargin);
        } else {
            modifiedPrice = basePrice;
        }
        
        const priceChange = modifiedPrice - p.current_price;
        const changeClass = priceChange > 0 ? 'positive' : priceChange < 0 ? 'negative' : 'neutral';
        
        // Recalculate all fees based on modified price
        const transactionFee = modifiedPrice * 0.065;
        const paymentFee = modifiedPrice * 0.04 + 0.2;
        const adFee = modifiedPrice * 0.15;
        const totalFees = transactionFee + paymentFee + adFee;
        
        const profitNoAds = modifiedPrice - p.material_cost - transactionFee - paymentFee - (p.postage_cost || 0);
        const profitWithAds = modifiedPrice - p.material_cost - totalFees - (p.postage_cost || 0);
        const marginNoAds = modifiedPrice > 0 ? (profitNoAds / modifiedPrice) * 100 : 0;
        const marginWithAds = modifiedPrice > 0 ? (profitWithAds / modifiedPrice) * 100 : 0;
        
        return `
            <tr class="${p.profit < 0 ? 'row-warning' : ''}">
                <td>
                    <input type="checkbox" 
                           class="row-checkbox" 
                           data-sku="${escapeHtml(p.variation_sku)}"
                           ${isChecked}
                           ${p.status === 'pushed' ? 'disabled' : ''}>
                </td>
                <td><strong>${escapeHtml(p.variation_sku)}</strong></td>
                <td>
                    <input type="number" 
                           class="modifier-input" 
                           data-sku="${escapeHtml(p.variation_sku)}"
                           value="${p.margin_modifier || 0}"
                           placeholder="0"
                           step="0.5"
                           min="0"
                           max="70"
                           title="Target profit margin % with ads"
                           ${p.status === 'pushed' ? 'disabled' : ''}>
                </td>
                <td class="number">
                    ${previousMargins.has(p.variation_sku) ? previousMargins.get(p.variation_sku) + '%' : '-'}
                </td>
                <td class="number">£${p.current_price.toFixed(2)}</td>
                <td class="number"><strong>£${modifiedPrice.toFixed(2)}</strong></td>
                <td class="number ${changeClass}">
                    ${priceChange >= 0 ? '+' : ''}£${priceChange.toFixed(2)}
                </td>
                <td class="number">£${p.material_cost.toFixed(2)}</td>
                <td class="number">£${transactionFee.toFixed(2)}</td>
                <td class="number">£${paymentFee.toFixed(2)}</td>
                <td class="number">£${adFee.toFixed(2)}</td>
                <td class="number">£${(p.postage_cost || 0).toFixed(2)}</td>
                <td class="number"><strong>£${totalFees.toFixed(2)}</strong></td>
                <td class="number ${profitNoAds < 0 ? 'negative' : 'positive'}">£${profitNoAds.toFixed(2)}</td>
                <td class="number ${profitWithAds < 0 ? 'negative' : 'positive'}">£${profitWithAds.toFixed(2)}</td>
                <td class="number ${marginNoAds < 0 ? 'negative' : 'positive'}">
                    ${marginNoAds.toFixed(1)}%
                </td>
                <td class="number ${marginWithAds < 0 ? 'negative' : 'positive'}">
                    ${marginWithAds.toFixed(1)}%
                </td>
                <td><span class="badge badge-${statusClass}">${p.status}</span></td>
            </tr>
        `;
    }).join('');
    
    // Attach checkbox listeners
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', handleRowSelect);
    });
    
    // Attach modifier input listeners
    document.querySelectorAll('.modifier-input').forEach(input => {
        input.addEventListener('change', handleModifierChange);
    });
    
    // Update select all checkbox state
    updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
    const checkboxes = document.querySelectorAll('.row-checkbox:not([disabled])');
    const checkedBoxes = document.querySelectorAll('.row-checkbox:not([disabled]):checked');
    
    if (checkboxes.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (checkedBoxes.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

function handleRowSelect(e) {
    const sku = e.target.dataset.sku;
    if (e.target.checked) {
        selectedSkus.add(sku);
    } else {
        selectedSkus.delete(sku);
    }
    updateSelectedCount();
    updateSelectAllCheckbox();
}

async function handleModifierChange(e) {
    const sku = e.target.dataset.sku;
    const modifier = parseFloat(e.target.value) || 0;
    
    // Store previous margin before updating
    const price = allPrices.find(p => p.variation_sku === sku);
    if (price) {
        const previousModifier = price.margin_modifier || 0;
        if (previousModifier !== modifier) {
            previousMargins.set(sku, previousModifier.toFixed(1));
        }
    }
    
    try {
        const response = await fetch('/api/pricing/update-modifier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variationSku: sku, marginModifier: modifier })
        });
        
        if (response.ok) {
            // Update local data and re-render
            const price = allPrices.find(p => p.variation_sku === sku);
            if (price) {
                price.margin_modifier = modifier;
                applyFilters();
            }
        } else {
            alert('Failed to update modifier');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function toggleSelectAll(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.row-checkbox:not([disabled])');
    
    console.log('Toggle select all:', isChecked, 'Found checkboxes:', checkboxes.length);
    
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const sku = cb.dataset.sku;
        if (isChecked) {
            selectedSkus.add(sku);
        } else {
            selectedSkus.delete(sku);
        }
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    selectedCount.textContent = `${selectedSkus.size} selected`;
}

async function approveSelected() {
    if (selectedSkus.size === 0) {
        alert('No variations selected');
        return;
    }
    
    try {
        const response = await fetch('/api/pricing/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variationSkus: Array.from(selectedSkus) })
        });
        
        if (response.ok) {
            selectedSkus.clear();
            updateSelectedCount();
            await loadStats();
            await loadPrices();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function rejectSelected() {
    if (selectedSkus.size === 0) {
        alert('No variations selected');
        return;
    }
    
    try {
        const response = await fetch('/api/pricing/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variationSkus: Array.from(selectedSkus) })
        });
        
        if (response.ok) {
            selectedSkus.clear();
            updateSelectedCount();
            await loadStats();
            await loadPrices();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function pushSelected() {
    if (selectedSkus.size === 0) {
        alert('No variations selected');
        return;
    }
    
    // Only allow approved items
    const selectedPrices = allPrices.filter(p => selectedSkus.has(p.variation_sku));
    const approvedOnly = selectedPrices.filter(p => p.status === 'approved');
    
    if (approvedOnly.length === 0) {
        alert('Only approved variations can be pushed to Etsy. Please approve prices first.');
        return;
    }
    
    const unapproved = selectedPrices.length - approvedOnly.length;
    let message = `Push ${approvedOnly.length} approved price(s) to Etsy?`;
    if (unapproved > 0) {
        message += `\n\n${unapproved} unapproved variation(s) will be skipped.`;
    }
    
    if (!confirm(message)) {
        return;
    }
    
    btnPushSelected.disabled = true;
    btnPushSelected.textContent = '⏳ Pushing to Etsy...';
    
    try {
        const response = await fetch('/api/pricing/push-to-etsy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                variationSkus: approvedOnly.map(p => p.variation_sku)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            let msg = `✓ Successfully pushed ${result.pushed} price(s) to Etsy!`;
            if (result.failed > 0) {
                msg += `\n\n⚠ ${result.failed} failed:`;
                result.details.failed.forEach(f => {
                    msg += `\n- ${f.variation_sku}: ${f.error}`;
                });
            }
            alert(msg);
            
            // Reload data
            selectedSkus.clear();
            updateSelectedCount();
            await loadStats();
            await loadPrices();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert('Error pushing to Etsy: ' + error.message);
    } finally {
        btnPushSelected.disabled = false;
        btnPushSelected.textContent = '⬆ Push to Etsy';
    }
}

async function applyBulkMargin() {
    if (selectedSkus.size === 0) {
        alert('Please select variations to apply margin to');
        return;
    }
    
    const margin = parseFloat(bulkMarginInput.value);
    if (isNaN(margin) || margin < 0) {
        alert('Please enter a valid target margin percentage (0-70)');
        return;
    }
    
    if (margin > 70) {
        alert('Target margin cannot exceed 70%');
        return;
    }
    
    const count = selectedSkus.size;
    if (!confirm(`Apply ${margin}% target margin to ${count} selected variation(s)?`)) {
        return;
    }
    
    btnApplyMargin.disabled = true;
    btnApplyMargin.textContent = '⏳ Applying...';
    
    try {
        let updated = 0;
        for (const sku of selectedSkus) {
            const response = await fetch('/api/pricing/update-modifier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variationSku: sku, marginModifier: margin })
            });
            
            if (response.ok) {
                const price = allPrices.find(p => p.variation_sku === sku);
                if (price) {
                    price.margin_modifier = margin;
                }
                updated++;
            }
        }
        
        alert(`Applied ${margin}% target margin to ${updated} variation(s)`);
        await loadPrices(); // Reload to get updated calculations
        applyFilters();
        
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        btnApplyMargin.disabled = false;
        btnApplyMargin.textContent = '📊 Apply to Selected';
    }
}

function resetFilters() {
    filterStatus.value = '';
    searchInput.value = '';
    applyFilters();
}

function getStatusClass(status) {
    const classes = {
        'pending': 'warning',
        'approved': 'success',
        'rejected': 'error',
        'pushed': 'info'
    };
    return classes[status] || 'default';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
