// Master Stock UI Logic
let editingSku = null;
let allProducts = [];

// DOM Elements
const modal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const productsTableBody = document.getElementById('productsTableBody');
const btnAddProduct = document.getElementById('btnAddProduct');
const btnCancel = document.getElementById('btnCancel');
const closeBtn = document.querySelector('.close');
const formError = document.getElementById('formError');

// Filter Elements
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const materialFilter = document.getElementById('materialFilter');
const btnClearFilters = document.getElementById('btnClearFilters');
const resultCount = document.getElementById('resultCount');

// Form inputs
const skuInput = document.getElementById('sku');
const typeInput = document.getElementById('type');
const lengthInput = document.getElementById('length');
const weightInput = document.getElementById('weight');
const materialInput = document.getElementById('material');
const postageCostInput = document.getElementById('postageCost');

// Event Listeners
btnAddProduct.addEventListener('click', openAddModal);
btnCancel.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
productForm.addEventListener('submit', handleSubmit);

// Filter event listeners
searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);
materialFilter.addEventListener('change', applyFilters);
btnClearFilters.addEventListener('click', clearFilters);

window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Load products and materials on page load
loadMaterials();
loadProducts();

async function loadMaterials() {
    try {
        const response = await fetch('/api/materials');
        const materials = await response.json();
        
        materialInput.innerHTML = '<option value="">Select material...</option>' + 
            materials.map(m => `<option value="${escapeHtml(m.materialId)}">${escapeHtml(m.name)}</option>`).join('');
        
        // Populate material filter
        materialFilter.innerHTML = '<option value="">All Materials</option>' +
            materials.map(m => `<option value="${escapeHtml(m.materialId)}">${escapeHtml(m.name)}</option>`).join('');
    } catch (error) {
        console.error('Error loading materials:', error);
    }
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeValue = typeFilter.value;
    const materialValue = materialFilter.value;

    const filtered = allProducts.filter(product => {
        const skuMatch = product.sku.toLowerCase().includes(searchTerm);
        const typeMatch = product.type.toLowerCase().includes(searchTerm);
        const typeFilterMatch = !typeValue || product.type === typeValue;
        const materialFilterMatch = !materialValue || product.material === materialValue;
        
        return (skuMatch || typeMatch) && typeFilterMatch && materialFilterMatch;
    });

    renderProducts(filtered);
    resultCount.textContent = `Showing ${filtered.length} of ${allProducts.length} products`;
}

function clearFilters() {
    searchInput.value = '';
    typeFilter.value = '';
    materialFilter.value = '';
    applyFilters();
}

function renderProducts(products) {
    if (products.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="9" class="empty">No products found.</td></tr>';
        return;
    }

    const tableHtml = products.map(product => `
        <tr>
            <td><strong>${escapeHtml(product.sku)}</strong></td>
            <td>${escapeHtml(product.type)}</td>
            <td class="number">${product.length}</td>
            <td class="number">${product.weight}</td>
            <td>${escapeHtml(product.material)}</td>
            <td class="number derived">£${product.costPerGram.toFixed(2)}</td>
            <td class="number derived">£${product.costOfItem.toFixed(2)}</td>
            <td class="number">£${product.postageCost.toFixed(2)}</td>
            <td class="actions">
                <button class="btn-small btn-primary" onclick="editProduct('${escapeHtml(product.sku)}')">Edit</button>
                <button class="btn-small btn-danger" onclick="deleteProduct('${escapeHtml(product.sku)}')">Delete</button>
            </td>
        </tr>
    `).join('');
    
    productsTableBody.innerHTML = tableHtml;
}

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        allProducts = await response.json();
        
        // Normalize product types to consistent casing (title case)
        allProducts = allProducts.map(p => ({
            ...p,
            type: p.type ? normalizeType(p.type) : p.type
        }));
        
        if (allProducts.length === 0) {
            productsTableBody.innerHTML = '<tr><td colspan="9" class="empty">No products found. Add your first product or use the Import feature.</td></tr>';
            typeFilter.innerHTML = '<option value="">All Types</option>';
            resultCount.textContent = 'Showing 0 products';
            return;
        }

        // Populate type filter with unique types
        const uniqueTypes = [...new Set(allProducts.map(p => p.type))].sort();
        typeFilter.innerHTML = '<option value="">All Types</option>' +
            uniqueTypes.map(type => `<option value="${type}">${escapeHtml(type)}</option>`).join('');

        resultCount.textContent = `Showing ${allProducts.length} products`;
        renderProducts(allProducts);
    } catch (error) {
        productsTableBody.innerHTML = `<div class="table-scroll"><table class="data-table products-table"><tbody><tr><td colspan="9" class="error">Error loading products: ${error.message}</td></tr></tbody></table></div>`;
    }
}

function openAddModal() {
    editingSku = null;
    modalTitle.textContent = 'Add Product';
    productForm.reset();
    skuInput.disabled = false;
    formError.textContent = '';
    modal.style.display = 'block';
}

async function editProduct(sku) {
    try {
        const response = await fetch(`/api/products/${encodeURIComponent(sku)}`);
        const product = await response.json();
        
        editingSku = sku;
        modalTitle.textContent = 'Edit Product';
        skuInput.value = product.sku;
        typeInput.value = product.type;
        lengthInput.value = product.length;
        weightInput.value = product.weight;
        materialInput.value = product.material;
        postageCostInput.value = product.postageCost;
        skuInput.disabled = true; // Immutable
        formError.textContent = '';
        modal.style.display = 'block';
    } catch (error) {
        alert(`Error loading product: ${error.message}`);
    }
}

async function deleteProduct(sku) {
    if (!confirm(`Delete product '${sku}'? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadProducts();
        } else {
            const error = await response.json();
            alert(`Error deleting product: ${error.error}`);
        }
    } catch (error) {
        alert(`Error deleting product: ${error.message}`);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    formError.textContent = '';

    const productData = {
        sku: skuInput.value.trim(),
        type: typeInput.value.trim(),
        length: parseFloat(lengthInput.value) || 0,
        weight: parseFloat(weightInput.value) || 0,
        material: materialInput.value,
        postageCost: parseFloat(postageCostInput.value) || 0
    };

    try {
        let response;
        if (editingSku) {
            response = await fetch(`/api/products/${encodeURIComponent(editingSku)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
        } else {
            response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
        }

        if (response.ok) {
            closeModal();
            loadProducts();
            applyFilters();
        } else {
            const error = await response.json();
            formError.textContent = error.error;
        }
    } catch (error) {
        formError.textContent = `Error: ${error.message}`;
    }
}

function closeModal() {
    modal.style.display = 'none';
    productForm.reset();
    editingSku = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeType(type) {
    // Normalize type to title case (first letter uppercase, rest lowercase)
    if (!type) return type;
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}
