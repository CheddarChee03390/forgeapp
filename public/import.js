// Flexible Import System - Handles Products and Materials with Column Mapping

// Import configuration
const importConfig = {
    products: {
        name: 'Master Stock (Products)',
        requiredFields: ['sku', 'weight', 'material'],
        optionalFields: ['type', 'length', 'postagecost'],
        template: [
            ['SKU', 'Type', 'Length', 'Weight', 'Material', 'postagecost'],
            ['BR-TU13_8', 'Bracelet', '8', '40', 'Silver', '8.9'],
            ['BR-TU13_9', 'Bracelet', '9', '45', 'Silver', '8.9']
        ]
    },
    materials: {
        name: 'Materials',
        requiredFields: ['materialId', 'costPerGram'],
        optionalFields: ['name'],
        template: [
            ['materialId', 'name', 'costPerGram'],
            ['Silver', 'Silver', '3.00'],
            ['Gold', 'Gold', '5.20'],
            ['Bronze', 'Bronze', '0.12']
        ]
    }
};

let csvData = [];
let csvHeaders = [];
let columnMap = {};
let currentImportType = 'products';

// DOM Elements
const importTypeSelect = document.getElementById('importType');
const importModeSelect = document.getElementById('importMode');
const downloadTemplateBtn = document.getElementById('downloadTemplate');
const csvFileInput = document.getElementById('csvFile');
const fileNameSpan = document.getElementById('fileName');
const mappingSection = document.getElementById('mappingSection');
const columnMappingDiv = document.getElementById('columnMapping');
const csvPreviewDiv = document.getElementById('csvPreview');
const btnPreview = document.getElementById('btnPreview');
const previewSection = document.getElementById('previewSection');
const previewStats = document.getElementById('previewStats');
const simulateBtn = document.getElementById('simulateBtn');
const executeBtn = document.getElementById('executeBtn');
const simulationResults = document.getElementById('simulationResults');
const resultsSection = document.getElementById('resultsSection');
const btnExportUnmapped = document.getElementById('btnExportUnmapped');
const btnExportMissingSku = document.getElementById('btnExportMissingSku');

// Event Listeners
importTypeSelect.addEventListener('change', handleImportTypeChange);
downloadTemplateBtn.addEventListener('click', downloadTemplate);
csvFileInput.addEventListener('change', handleFileSelect);
btnPreview.addEventListener('click', showPreview);
simulateBtn.addEventListener('click', simulateImport);
executeBtn.addEventListener('click', executeImport);
btnExportUnmapped.addEventListener('click', exportUnmapped);
btnExportMissingSku.addEventListener('click', exportMissingSku);

function handleImportTypeChange() {
    currentImportType = importTypeSelect.value;
    // Reset everything
    csvFileInput.value = '';
    fileNameSpan.textContent = 'No file selected';
    mappingSection.style.display = 'none';
    previewSection.style.display = 'none';
    resultsSection.style.display = 'none';
}

function downloadTemplate() {
    const type = importTypeSelect.value;
    const config = importConfig[type];
    
    // Create CSV content
    const csvContent = config.template.map(row => row.join(',')).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_import_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    fileNameSpan.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        parseCSV(event.target.result);
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        alert('CSV file must have at least a header row and one data row');
        return;
    }
    
    // Parse headers
    csvHeaders = lines[0].split(',').map(h => h.trim());
    
    // Parse data
    csvData = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const row = { _rowIndex: index + 2 }; // +2 because header is row 1
        csvHeaders.forEach((header, i) => {
            row[header] = values[i] || '';
        });
        return row;
    });
    
    showColumnMapping();
}

function showColumnMapping() {
    const config = importConfig[currentImportType];
    const allFields = [...config.requiredFields, ...config.optionalFields];
    
    columnMappingDiv.innerHTML = '';
    columnMap = {};
    
    // Create mapping dropdowns
    allFields.forEach(field => {
        const isRequired = config.requiredFields.includes(field);
        const row = document.createElement('div');
        row.className = 'mapping-row';
        
        const label = document.createElement('label');
        label.textContent = field.charAt(0).toUpperCase() + field.slice(1);
        if (isRequired) label.className = 'required-field';
        
        const select = document.createElement('select');
        select.className = 'form-control';
        select.dataset.field = field;
        
        // Add options
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select CSV Column --';
        select.appendChild(defaultOption);
        
        csvHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            // Auto-match if names are similar
            if (header.toLowerCase() === field.toLowerCase() || 
                header.toLowerCase().replace(/[_-]/g, '') === field.toLowerCase().replace(/[_-]/g, '')) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        row.appendChild(label);
        row.appendChild(select);
        columnMappingDiv.appendChild(row);
    });
    
    // Show CSV preview
    showCSVPreview();
    
    mappingSection.style.display = 'block';
}

function showCSVPreview() {
    const previewRows = csvData.slice(0, 5);
    
    let html = '<h4>CSV Preview (First 5 Rows)</h4>';
    html += '<div class="table-container"><table class="data-table"><thead><tr>';
    
    csvHeaders.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    previewRows.forEach(row => {
        html += '<tr>';
        csvHeaders.forEach(header => {
            html += `<td>${row[header]}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    csvPreviewDiv.innerHTML = html;
}

function showPreview() {
    // Validate mapping
    const config = importConfig[currentImportType];
    const selects = columnMappingDiv.querySelectorAll('select');
    columnMap = {};
    
    let missingRequired = [];
    selects.forEach(select => {
        const field = select.dataset.field;
        const csvColumn = select.value;
        
        if (csvColumn) {
            columnMap[field] = csvColumn;
        } else if (config.requiredFields.includes(field)) {
            missingRequired.push(field);
        }
    });
    
    if (missingRequired.length > 0) {
        alert(`Please map required fields: ${missingRequired.join(', ')}`);
        return;
    }
    
    // Map data
    const mappedData = csvData.map(row => {
        const mapped = {};
        Object.keys(columnMap).forEach(field => {
            const csvColumn = columnMap[field];
            mapped[field] = row[csvColumn];
        });
        return mapped;
    });
    
    // Show stats
    showPreviewStats(mappedData);
    
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth' });
}

function showPreviewStats(data) {
    const mode = importModeSelect.value;
    const modeText = {
        'add': 'Add New Only',
        'update': 'Update Existing Only',
        'both': 'Add & Update'
    };
    
    previewStats.innerHTML = `
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-number">${data.length}</div>
                <div class="stat-label">Total Rows</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Object.keys(columnMap).length}</div>
                <div class="stat-label">Mapped Fields</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><strong>Import Type:</strong> ${importConfig[currentImportType].name}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><strong>Mode:</strong> ${modeText[mode]}</div>
            </div>
        </div>
    `;
}

async function simulateImport() {
    try {
        simulateBtn.disabled = true;
        simulateBtn.textContent = '🔍 Simulating...';
        
        // Map data
        const mappedData = csvData.map(row => {
            const mapped = {};
            Object.keys(columnMap).forEach(field => {
                const csvColumn = columnMap[field];
                mapped[field] = row[csvColumn];
            });
            return mapped;
        });
        
        const endpoint = currentImportType === 'products' 
            ? '/api/products/import/simulate'
            : '/api/materials/import/simulate';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: mappedData,
                mode: importModeSelect.value
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displaySimulationResults(result);
            executeBtn.disabled = false;
        } else {
            alert('Simulation failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error during simulation: ' + error.message);
    } finally {
        simulateBtn.disabled = false;
        simulateBtn.textContent = '🔍 Simulate Import';
    }
}

function displaySimulationResults(result) {
    const { toAdd, toUpdate, toSkip, errors } = result;
    
    let html = '<div class="stat-grid">';
    html += `<div class="stat-item"><div class="stat-number" style="color: #28a745;">${toAdd?.length || 0}</div><div class="stat-label">Will Add</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #17a2b8;">${toUpdate?.length || 0}</div><div class="stat-label">Will Update</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #6c757d;">${toSkip?.length || 0}</div><div class="stat-label">Will Skip</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #dc3545;">${errors?.length || 0}</div><div class="stat-label">Errors</div></div>`;
    html += '</div>';
    
    if (errors && errors.length > 0) {
        html += '<div class="alert alert-danger" style="margin-top: 1rem;"><strong>Errors Found:</strong><ul>';
        errors.slice(0, 10).forEach(err => {
            html += `<li>Row ${err.row}: ${err.error}</li>`;
        });
        if (errors.length > 10) html += `<li>... and ${errors.length - 10} more errors</li>`;
        html += '</ul></div>';
    }
    
    simulationResults.innerHTML = html;
}

async function executeImport() {
    if (!confirm('Are you sure you want to execute this import? This will modify your database.')) {
        return;
    }
    
    try {
        executeBtn.disabled = true;
        executeBtn.textContent = '⏳ Importing...';
        
        // Map data
        const mappedData = csvData.map(row => {
            const mapped = {};
            Object.keys(columnMap).forEach(field => {
                const csvColumn = columnMap[field];
                mapped[field] = row[csvColumn];
            });
            return mapped;
        });
        
        const endpoint = currentImportType === 'products' 
            ? '/api/products/import/execute'
            : '/api/materials/import/execute';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: mappedData,
                mode: importModeSelect.value
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayImportResults(result);
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Import failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error during import: ' + error.message);
    } finally {
        executeBtn.disabled = false;
        executeBtn.textContent = '✅ Execute Import';
    }
}

function displayImportResults(result) {
    const { success, errors, skipped } = result;
    
    let html = '<div class="stat-grid">';
    html += `<div class="stat-item"><div class="stat-number" style="color: #28a745;">${success?.length || 0}</div><div class="stat-label">Imported</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #6c757d;">${skipped?.length || 0}</div><div class="stat-label">Skipped</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #dc3545;">${errors?.length || 0}</div><div class="stat-label">Errors</div></div>`;
    html += '</div>';
    
    document.getElementById('resultsStats').innerHTML = html;
    
    let detailsHtml = '';
    if (errors && errors.length > 0) {
        detailsHtml += '<div class="alert alert-danger"><strong>Errors:</strong><ul>';
        errors.forEach(err => {
            detailsHtml += `<li>${err.sku || err.materialId}: ${err.error}</li>`;
        });
        detailsHtml += '</ul></div>';
    }
    
    if (success && success.length > 0) {
        detailsHtml += `<div class="alert alert-success">Successfully imported ${success.length} records!</div>`;
    }
    
    document.getElementById('resultsDetails').innerHTML = detailsHtml;
}

// Export unmapped Etsy variations (no internal SKU mapping)
async function exportUnmapped() {
    try {
        btnExportUnmapped.disabled = true;
        btnExportUnmapped.textContent = '⏳ Exporting...';
        
        const response = await fetch('/api/etsy/export/unmapped');
        if (!response.ok) {
            throw new Error('Failed to fetch unmapped variations');
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            alert('No unmapped variations found!');
            return;
        }
        
        // Create CSV content
        const headers = ['Listing ID', 'Listing Title', 'Variation SKU', 'Current Price', 'Quantity', 'Internal SKU (empty)'];
        const rows = data.map(v => [
            v.listing_id,
            `"${(v.listing_title || '').replace(/"/g, '""')}"`,
            v.variation_sku,
            v.price || 0,
            v.quantity || 0,
            '' // Empty column for manual mapping
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unmapped_variations_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`Exported ${data.length} unmapped variations`);
    } catch (error) {
        alert('Error exporting unmapped: ' + error.message);
    } finally {
        btnExportUnmapped.disabled = false;
        btnExportUnmapped.textContent = '📤 Export Unmapped';
    }
}

// Export variations/listings with missing SKUs
async function exportMissingSku() {
    try {
        btnExportMissingSku.disabled = true;
        btnExportMissingSku.textContent = '⏳ Exporting...';
        
        const response = await fetch('/api/etsy/export/missing-sku');
        if (!response.ok) {
            throw new Error('Failed to fetch missing SKU data');
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            alert('No listings/variations with missing SKUs found!');
            return;
        }
        
        // Create CSV content
        const headers = ['Listing ID', 'Listing Title', 'Has Variations', 'Variation SKU', 'Current Price', 'Quantity', 'Type'];
        const rows = data.map(item => [
            item.listing_id,
            `"${(item.listing_title || item.title || '').replace(/"/g, '""')}"`,
            item.has_variations ? 'Yes' : 'No',
            item.variation_sku || 'N/A',
            item.price || 0,
            item.quantity || 0,
            item.type // 'parent_no_variations' or 'variation_missing_sku'
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `missing_skus_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`Exported ${data.length} items with missing SKUs`);
    } catch (error) {
        alert('Error exporting missing SKUs: ' + error.message);
    } finally {
        btnExportMissingSku.disabled = false;
        btnExportMissingSku.textContent = '📤 Export Missing SKUs';
    }
}
