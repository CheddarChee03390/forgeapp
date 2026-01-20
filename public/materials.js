// Materials Manager UI Logic
let editingMaterialId = null;

// DOM Elements
const modal = document.getElementById('materialModal');
const modalTitle = document.getElementById('modalTitle');
const materialForm = document.getElementById('materialForm');
const materialsTableBody = document.getElementById('materialsTableBody');
const btnAddMaterial = document.getElementById('btnAddMaterial');
const btnCancel = document.getElementById('btnCancel');
const closeBtn = document.querySelector('.close');
const formError = document.getElementById('formError');

// Form inputs
const materialIdInput = document.getElementById('materialId');
const materialNameInput = document.getElementById('materialName');
const costPerGramInput = document.getElementById('costPerGram');
const sellPricePerGramInput = document.getElementById('sellPricePerGram');

// Event Listeners
btnAddMaterial.addEventListener('click', openAddModal);
btnCancel.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
materialForm.addEventListener('submit', handleSubmit);

window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Load materials on page load
loadMaterials();

async function loadMaterials() {
    try {
        const response = await fetch('/api/materials');
        const materials = await response.json();
        
        if (materials.length === 0) {
            materialsTableBody.innerHTML = '<tr><td colspan="5" class="empty">No materials found. Add your first material to get started.</td></tr>';
            return;
        }

        materialsTableBody.innerHTML = materials.map(material => `
            <tr>
                <td><strong>${escapeHtml(material.materialId)}</strong></td>
                <td>${escapeHtml(material.name)}</td>
                <td class="number">£${material.costPerGram.toFixed(2)}</td>
                <td class="number">£${(material.sellPricePerGram || 0).toFixed(2)}</td>
                <td class="actions">
                    <button class="btn-small btn-primary" onclick="editMaterial('${escapeHtml(material.materialId)}')">Edit</button>
                    <button class="btn-small btn-danger" onclick="deleteMaterial('${escapeHtml(material.materialId)}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        materialsTableBody.innerHTML = `<tr><td colspan="5" class="error">Error loading materials: ${error.message}</td></tr>`;
    }
}

function openAddModal() {
    editingMaterialId = null;
    modalTitle.textContent = 'Add Material';
    materialForm.reset();
    materialIdInput.disabled = false;
    formError.textContent = '';
    modal.style.display = 'block';
}

async function editMaterial(materialId) {
    try {
        const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}`);
        const material = await response.json();
        
        editingMaterialId = materialId;
        modalTitle.textContent = 'Edit Material';
        materialIdInput.value = material.materialId;
        materialNameInput.value = material.name;
        costPerGramInput.value = material.costPerGram;
        sellPricePerGramInput.value = material.sellPricePerGram || 0;
        materialIdInput.disabled = true; // Immutable
        formError.textContent = '';
        modal.style.display = 'block';
    } catch (error) {
        alert(`Error loading material: ${error.message}`);
    }
}

async function deleteMaterial(materialId) {
    if (!confirm(`Delete material '${materialId}'? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadMaterials();
        } else {
            const error = await response.json();
            alert(`Error deleting material: ${error.error}`);
        }
    } catch (error) {
        alert(`Error deleting material: ${error.message}`);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    formError.textContent = '';

    const materialData = {
        materialId: materialIdInput.value.trim(),
        name: materialNameInput.value.trim(),
        costPerGram: parseFloat(costPerGramInput.value),
        sellPricePerGram: parseFloat(sellPricePerGramInput.value) || 0
    };

    try {
        let response;
        if (editingMaterialId) {
            response = await fetch(`/api/materials/${encodeURIComponent(editingMaterialId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });
        } else {
            response = await fetch('/api/materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });
        }

        if (response.ok) {
            closeModal();
            loadMaterials();
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
    materialForm.reset();
    editingMaterialId = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
