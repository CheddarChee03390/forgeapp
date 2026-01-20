// Etsy Inventory UI Logic with OAuth

const btnConnect = document.getElementById('btnConnect');
const btnSync = document.getElementById('btnSync');
const btnDisconnect = document.getElementById('btnDisconnect');
const authStatus = document.getElementById('authStatus');
const statsSection = document.getElementById('statsSection');
const listingsCard = document.getElementById('listingsCard');
const listingsTableBody = document.getElementById('listingsTableBody');
const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statQuantity = document.getElementById('statQuantity');
const statLastSync = document.getElementById('statLastSync');
const statVariations = document.getElementById('statVariations');
const statWithVariations = document.getElementById('statWithVariations');
const statUnmapped = document.getElementById('statUnmapped');
const statLowStock = document.getElementById('statLowStock');
const statActiveMappings = document.getElementById('statActiveMappings');
const statInactiveMappings = document.getElementById('statInactiveMappings');
const searchInput = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');
const btnClearSearch = document.getElementById('btnClearSearch');
const filterMapping = document.getElementById('filterMapping');
const filterVariations = document.getElementById('filterVariations');
const filterState = document.getElementById('filterState');
const btnResetFilters = document.getElementById('btnResetFilters');

// Store all listings for filtering
let allListings = [];
let mappingData = {};

btnConnect.addEventListener('click', connectToEtsy);
btnSync.addEventListener('click', syncFromEtsy);
btnDisconnect.addEventListener('click', disconnectFromEtsy);
btnSearch.addEventListener('click', handleSearch);
btnClearSearch.addEventListener('click', clearSearch);
btnResetFilters.addEventListener('click', resetFilters);
filterMapping.addEventListener('change', applyFilters);
filterVariations.addEventListener('change', applyFilters);
filterState.addEventListener('change', applyFilters);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
});

// Initial load
checkAuthStatus();

async function checkAuthStatus() {
    try {
        const response = await fetch('/oauth/status');
        const data = await response.json();

        if (data.authenticated) {
            showAuthenticatedUI();
            await Promise.all([loadStats(), loadListings()]);
        } else {
            showUnauthenticatedUI();
            // Still load listings from local DB even when disconnected
            await Promise.all([loadStats(), loadListings()]);
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showUnauthenticatedUI();
        // Still load listings from local DB even when disconnected
        await Promise.all([loadStats(), loadListings()]);
    }
}

function showAuthenticatedUI() {
    authStatus.style.display = 'none';
    statsSection.style.display = 'grid';
    listingsCard.style.display = 'block';
    btnConnect.style.display = 'none';
    btnSync.style.display = 'inline-block';
    btnDisconnect.style.display = 'inline-block';
}

function showUnauthenticatedUI() {
    authStatus.style.display = 'block';
    statsSection.style.display = 'grid'; // Show stats even when disconnected
    listingsCard.style.display = 'block'; // Show listings even when disconnected
    btnConnect.style.display = 'inline-block';
    btnSync.style.display = 'none';
    btnDisconnect.style.display = 'none';
}

function connectToEtsy() {
    const width = 600;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const popup = window.open(
        '/oauth/authorize',
        'EtsyOAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    );

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data === 'oauth-complete') {
            popup?.close();
            checkAuthStatus();
        }
    });
}

async function disconnectFromEtsy() {
    if (!confirm('Are you sure you want to disconnect from Etsy?')) return;

    try {
        const response = await fetch('/oauth/disconnect', { method: 'POST' });
        if (response.ok) {
            alert('✅ Disconnected from Etsy successfully');
            showUnauthenticatedUI();
        } else {
            alert('❌ Failed to disconnect');
        }
    } catch (error) {
        console.error('Error disconnecting:', error);
        alert('❌ Error disconnecting from Etsy');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/etsy/stats/summary');
        const stats = await response.json();

        statTotal.textContent = stats.total || 0;
        statActive.textContent = stats.active || 0;
        statQuantity.textContent = stats.total_quantity || 0;
        statVariations.textContent = stats.total_variations || 0;
        statWithVariations.textContent = stats.with_variations || 0;
        statLowStock.textContent = stats.low_stock || 0;
        
        // Mapping stats
        statActiveMappings.textContent = stats.active_mappings || 0;
        statInactiveMappings.textContent = stats.inactive_mappings || 0;
        
        // Unmapped variations with color coding
        const unmapped = stats.unmapped_variations || 0;
        statUnmapped.textContent = unmapped;
        const unmappedCard = statUnmapped.closest('.stat-card');
        if (unmappedCard) {
            if (unmapped === 0) {
                unmappedCard.classList.add('stat-success');
                unmappedCard.classList.remove('stat-error', 'stat-warning');
            } else if (unmapped < 10) {
                unmappedCard.classList.add('stat-warning');
                unmappedCard.classList.remove('stat-success', 'stat-error');
            } else {
                unmappedCard.classList.add('stat-error');
                unmappedCard.classList.remove('stat-success', 'stat-warning');
            }
        }

        if (stats.last_sync_time) {
            const date = new Date(stats.last_sync_time * 1000);
            statLastSync.textContent = formatDate(date);
        } else {
            statLastSync.textContent = 'Never';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadListings() {
    try {
        const response = await fetch('/api/etsy');
        const listings = await response.json();
        allListings = listings; // Store for filtering
        applyFilters();
    } catch (error) {
        console.error('Error loading listings:', error);
        listingsTableBody.innerHTML = '<tr><td colspan="12" class="text-center error">Error loading listings</td></tr>';
    }
}

function applyFilters() {
    let filtered = [...allListings];
    
    // Apply search filter
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(listing => 
            listing.title?.toLowerCase().includes(searchTerm) ||
            listing.sku?.toLowerCase().includes(searchTerm) ||
            listing.listing_id?.toString().includes(searchTerm)
        );
    }
    
    // Apply mapping filter
    const mappingFilter = filterMapping.value;
    if (mappingFilter !== 'all') {
        filtered = filtered.filter(listing => {
            if (!listing.has_variations) return mappingFilter === 'full'; // No variations = always fully mapped
            
            const mappingInfo = mappingData[listing.listing_id];
            if (!mappingInfo) return mappingFilter === 'unmapped';
            
            const { mapped, total } = mappingInfo;
            if (mappingFilter === 'unmapped') return mapped === 0;
            if (mappingFilter === 'partial') return mapped > 0 && mapped < total;
            if (mappingFilter === 'full') return mapped === total && mapped > 0;
            return true;
        });
    }
    
    // Apply variations filter
    const variationsFilter = filterVariations.value;
    if (variationsFilter === 'with') {
        filtered = filtered.filter(listing => listing.has_variations);
    } else if (variationsFilter === 'without') {
        filtered = filtered.filter(listing => !listing.has_variations);
    }
    
    // Apply state filter
    const stateFilter = filterState.value;
    if (stateFilter !== 'all') {
        filtered = filtered.filter(listing => listing.state === stateFilter);
    }
    
    displayListings(filtered);
}

function resetFilters() {
    searchInput.value = '';
    filterMapping.value = 'all';
    filterVariations.value = 'all';
    filterState.value = 'all';
    applyFilters();
}

function displayListings(listings) {
    if (!Array.isArray(listings) || listings.length === 0) {
        listingsTableBody.innerHTML = '<tr><td colspan="12" class="text-center">No listings match your filters.</td></tr>';
        return;
    }

    listingsTableBody.innerHTML = listings.map((listing) => {
        const hasVariations = !!listing.has_variations;
        const variationButton = hasVariations
            ? `<button class="btn btn-small btn-secondary" onclick="toggleVariations(${listing.listing_id})">View variations</button>`
            : '-';
        
        // Show mapped status for all listings
        const mappedBadge = listing.is_mapped 
            ? '<span class="badge badge-success">✓ Mapped</span>' 
            : '<span class="badge badge-warning">✗ Unmapped</span>';

        // Format price - show range if variations exist
        let priceDisplay;
        if (hasVariations && listing.price_range) {
            const minPrice = listing.price_range.min.toFixed(2);
            const maxPrice = listing.price_range.max.toFixed(2);
            if (minPrice === maxPrice) {
                priceDisplay = `£${minPrice}`;
            } else {
                priceDisplay = `£${minPrice} - £${maxPrice}`;
            }
        } else {
            priceDisplay = `£${(listing.price || 0).toFixed(2)}`;
        }

        return `
        <tr>
            <td>${listing.listing_id}</td>
            <td>
                <a href="${listing.url}" target="_blank" class="listing-title">
                    ${escapeHtml(listing.title)}
                </a>
            </td>
            <td>${escapeHtml(listing.sku || '-')}</td>
            <td class="${listing.quantity === 0 ? 'text-danger' : ''}">${listing.quantity}</td>
            <td>${priceDisplay}</td>
            <td><span class="badge ${listing.state === 'active' ? 'badge-success' : 'badge-secondary'}">${listing.state}</span></td>
            <td>${listing.views || 0}</td>
            <td>${listing.num_favorers || 0}</td>
            <td>${formatDate(new Date(listing.updated_timestamp * 1000))}</td>
            <td>${mappedBadge}</td>
            <td class="actions">${variationButton}</td>
            <td>
                <a href="${listing.url}" target="_blank" class="btn btn-sm btn-primary">View</a>
            </td>
        </tr>
        <tr id="var-row-${listing.listing_id}" class="variation-row" style="display:none;">
            <td colspan="12">
                <div class="variation-container" id="var-content-${listing.listing_id}">Loading variations...</div>
            </td>
        </tr>`;
    }).join('');
    
    // Load mapping counts for listings with variations
    listings.forEach(listing => {
        if (listing.has_variations) {
            loadMappingCount(listing.listing_id);
        }
    });
}

async function toggleVariations(listingId) {
    const row = document.getElementById(`var-row-${listingId}`);
    const container = document.getElementById(`var-content-${listingId}`);
    if (!row || !container) return;

    const isVisible = row.style.display === 'table-row';
    if (isVisible) {
        row.style.display = 'none';
        return;
    }

    row.style.display = 'table-row';
    container.textContent = 'Loading variations...';

    try {
        const response = await fetch(`/api/etsy/${listingId}/variations`);
        const variations = await response.json();

        if (!Array.isArray(variations) || variations.length === 0) {
            container.textContent = 'No variations for this listing.';
            return;
        }

        container.innerHTML = renderVariationsTable(listingId, variations);
    } catch (error) {
        console.error('Error loading variations:', error);
        container.textContent = 'Error loading variations.';
    }
}

function renderVariationsTable(listingId, variations) {
    return `
        <table class="variation-table">
            <thead>
                <tr>
                    <th>Variation SKU</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Internal SKU</th>
                </tr>
            </thead>
            <tbody>
                ${variations.map((v) => `
                    <tr>
                        <td>${escapeHtml(v.variation_sku || '-')}</td>
                        <td>${v.quantity ?? '-'}</td>
                        <td>£${(v.price || 0).toFixed(2)}</td>
                        <td>${escapeHtml(v.internal_sku || v.internal_product_sku || '—')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadMappingCount(listingId) {
    try {
        const response = await fetch(`/api/etsy/${listingId}/variations`);
        if (!response.ok) return;
        
        const variations = await response.json();
        const totalVariations = variations.length;
        const mappedVariations = variations.filter(v => v.internal_sku).length;
        
        // Store mapping data for filtering
        mappingData[listingId] = {
            mapped: mappedVariations,
            total: totalVariations
        };
        
        const cellId = `mapped-${listingId}`;
        const cell = document.getElementById(cellId);
        if (cell) {
            const percentage = totalVariations > 0 ? Math.round((mappedVariations / totalVariations) * 100) : 0;
            const badgeClass = percentage === 100 ? 'badge-success' : percentage > 0 ? 'badge-warning' : 'badge-secondary';
            cell.innerHTML = `<span class="badge ${badgeClass}">${mappedVariations}/${totalVariations}</span>`;
        }
    } catch (error) {
        console.error('Error loading mapping count:', error);
    }
}

async function syncFromEtsy() {
    btnSync.disabled = true;
    const previous = btnSync.textContent;
    btnSync.textContent = '⏳ Syncing...';

    try {
        const response = await fetch('/api/etsy/sync', { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            const syncedCount = result.saved ?? result.count ?? result.fetched ?? 0;
            alert(`✅ Sync complete! ${syncedCount} listings synchronized.`);
            await Promise.all([loadStats(), loadListings()]);
        } else {
            if (result.error && result.error.includes('Not authenticated')) {
                alert('❌ Session expired. Please reconnect to Etsy.');
                showUnauthenticatedUI();
            } else {
                alert(`❌ Sync failed: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('Error syncing:', error);
        alert('❌ Error syncing from Etsy');
    } finally {
        btnSync.disabled = false;
        btnSync.textContent = previous;
    }
}

async function handleSearch() {
    applyFilters(); // Search is now handled by filters
}

function clearSearch() {
    searchInput.value = '';
    applyFilters();
}

function formatDate(date) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
