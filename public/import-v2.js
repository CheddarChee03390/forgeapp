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
    },
    'sku-mapping': {
        name: 'Etsy SKU Mapping',
        requiredFields: ['variation_sku', 'internal_sku'],
        optionalFields: [],
        template: [
            ['variation_sku', 'internal_sku'],
            ['ETSY-123-RED-S', 'MSK-RED-S'],
            ['ETSY-123-BLU-M', 'MSK-BLU-M']
        ]
    },
    'etsy-statement': {
        name: 'Etsy Statement (Fees & Refunds)',
        requiredFields: ['Date', 'Type', 'Title', 'Currency', 'Amount'],
        optionalFields: [],
        template: [
            ['Date', 'Type', 'Title', 'Info', 'Currency', 'Amount', 'Fees & Taxes', 'Net', 'Tax Details'],
            ['15 Jan, 2026', 'Sale', 'Sale of Order #1234567890', '', 'GBP', '£100.00', '-£6.50', '£93.50', ''],
            ['15 Jan, 2026', 'Fee', 'Transaction fee (6.5% of £100)', '', 'GBP', '-£6.50', '', '-£6.50', '']
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
const csvUploadSection = document.getElementById('csvUploadSection');
const importModeGroup = document.getElementById('importModeGroup');
const mappingSection = document.getElementById('mappingSection');
const columnMappingDiv = document.getElementById('columnMapping');
const csvPreviewDiv = document.getElementById('csvPreview');
const btnPreview = document.getElementById('btnPreview');
const previewSection = document.getElementById('previewSection');
const previewStats = document.getElementById('previewStats');
const simulateBtn = document.getElementById('simulateBtn');
const executeBtn = document.getElementById('executeBtn');
const bulkExecuteBtn = document.getElementById('bulkExecuteBtn');
const simulationResults = document.getElementById('simulationResults');
const resultsSection = document.getElementById('resultsSection');
const btnExportUnmapped = document.getElementById('btnExportUnmapped');
const btnExportMissingSku = document.getElementById('btnExportMissingSku');
const btnExportSkipped = document.getElementById('btnExportSkipped');

// Event Listeners
importTypeSelect.addEventListener('change', handleImportTypeChange);
downloadTemplateBtn.addEventListener('click', downloadTemplate);
csvFileInput.addEventListener('change', handleFileSelect);
btnPreview.addEventListener('click', showPreview);
simulateBtn.addEventListener('click', simulateImport);
executeBtn.addEventListener('click', executeImport);
if (bulkExecuteBtn) bulkExecuteBtn.addEventListener('click', bulkExecuteImport);
// Ensure correct sections shown initially
handleImportTypeChange();

function handleImportTypeChange() {
    currentImportType = importTypeSelect.value;
    // For all import types (including SKU mapping), use the CSV-driven flow.
    if (csvUploadSection) csvUploadSection.style.display = '';
    mappingSection.style.display = 'none';
    previewSection.style.display = 'none';
    resultsSection.style.display = 'none';
    if (csvFileInput) csvFileInput.value = '';
    if (fileNameSpan) fileNameSpan.textContent = 'No file selected';
    if (executeBtn) executeBtn.disabled = true;
    if (bulkExecuteBtn) bulkExecuteBtn.disabled = true;
    
    // Show statement month selector for Etsy Statement import
    const statementMonthSection = document.getElementById('statementMonthSection');
    if (currentImportType === 'etsy-statement') {
        if (statementMonthSection) statementMonthSection.style.display = 'block';
        if (importModeGroup) importModeGroup.style.display = 'none'; // not applicable to statements
        if (bulkExecuteBtn) bulkExecuteBtn.style.display = 'inline-block';
    } else {
        if (statementMonthSection) statementMonthSection.style.display = 'none';
        if (importModeGroup) importModeGroup.style.display = ''; // show for other imports
        if (bulkExecuteBtn) bulkExecuteBtn.style.display = 'none';
    }
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
    
    // For Etsy Statement, skip column mapping and go straight to preview
    if (currentImportType === 'etsy-statement') {
        csvHeaders = lines[0].split(',').map(h => h.trim());
        csvData = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const row = { _rowIndex: index + 2 };
            csvHeaders.forEach((header, i) => {
                row[header] = values[i] || '';
            });
            return row;
        });
        // Skip mapping section for Etsy statement - go straight to preview
        previewSection.style.display = 'block';
        mappingSection.style.display = 'none';
        simulateBtn.disabled = false;
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
        
        let response;
        
        // Handle Etsy Statement import (file upload)
        if (currentImportType === 'etsy-statement') {
            const formData = new FormData();
            formData.append('file', csvFileInput.files[0]);
            
            response = await fetch('/api/import/etsy-statement/simulate', {
                method: 'POST',
                body: formData
            });
        } else {
            // Handle other imports (JSON data)
            const mappedData = csvData.map(row => {
                const mapped = {};
                Object.keys(columnMap).forEach(field => {
                    const csvColumn = columnMap[field];
                    mapped[field] = row[csvColumn];
                });
                return mapped;
            });
            
            let endpoint = '/api/products/import/simulate';
            if (currentImportType === 'materials') endpoint = '/api/materials/import/simulate';
            if (currentImportType === 'sku-mapping') endpoint = '/api/etsy/mappings/import/simulate';
            
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    data: mappedData,
                    mode: importModeSelect.value
                })
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            displaySimulationResults(result);
            // Enable execute buttons for etsy-statement when simulation succeeds
            if (currentImportType === 'etsy-statement') {
                executeBtn.disabled = false;
                if (bulkExecuteBtn) bulkExecuteBtn.disabled = false;
            } else {
                executeBtn.disabled = false;
            }
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
    let html = '<div class="stat-grid">';
    
    // Handle both formats: standard (toAdd/toUpdate/toSkip) and etsy-statement (wouldImport)
    if (result.simulation && result.simulation.wouldImport) {
        // Etsy statement format
        const { feeRecords, refunds, postageRecords } = result.simulation.wouldImport;
        html += `<div class="stat-item"><div class="stat-number" style="color: #28a745;">${feeRecords || 0}</div><div class="stat-label">Fees</div></div>`;
        html += `<div class="stat-item"><div class="stat-number" style="color: #17a2b8;">${refunds || 0}</div><div class="stat-label">Refunds</div></div>`;
        html += `<div class="stat-item"><div class="stat-number" style="color: #6c757d;">${postageRecords || 0}</div><div class="stat-label">Postage</div></div>`;
        html += `<div class="stat-item"><div class="stat-number">${result.simulation.totalRows}</div><div class="stat-label">Total Rows</div></div>`;

        // Extra insights if provided
        if (result.simulation.monthDetected) {
            html += `<div class="stat-item"><div class="stat-number">${result.simulation.monthDetected}</div><div class="stat-label">Detected Month</div></div>`;
        }
        if (result.simulation.orderLinkStats) {
            const ol = result.simulation.orderLinkStats.orderLinked || 0;
            const sl = result.simulation.orderLinkStats.shopLevel || 0;
            html += `<div class="stat-item"><div class="stat-number" style="color:#007bff;">${ol}</div><div class="stat-label">Order-Linked</div></div>`;
            html += `<div class="stat-item"><div class="stat-number" style="color:#fd7e14;">${sl}</div><div class="stat-label">Shop-Level</div></div>`;
        }
    } else {
        // Standard format
        const { toAdd, toUpdate, toSkip, errors } = result;
        html += `<div class="stat-item"><div class="stat-number" style="color: #28a745;">${toAdd?.length || 0}</div><div class="stat-label">Will Add</div></div>`;
        html += `<div class="stat-item"><div class="stat-number" style="color: #17a2b8;">${toUpdate?.length || 0}</div><div class="stat-label">Will Update</div></div>`;
        html += `<div class="stat-item"><div class="stat-number" style="color: #6c757d;">${toSkip?.length || 0}</div><div class="stat-label">Will Skip</div></div>`;
        html += `<div class="stat-item"><div class="stat-number" style="color: #dc3545;">${errors?.length || 0}</div><div class="stat-label">Errors</div></div>`;
    }
    
    html += '</div>';
    
    // Month breakdown table if available
    if (result.simulation && result.simulation.monthCounts) {
        const mcounts = result.simulation.monthCounts;
        const mkeys = Object.keys(mcounts);
        if (mkeys.length > 0) {
            html += '<h4 style="margin-top:1rem;">Month Breakdown</h4>';
            html += '<div class="table-container"><table class="data-table"><thead><tr><th>Month</th><th>Rows</th></tr></thead><tbody>';
            mkeys.forEach(m => {
                html += `<tr><td>${m}</td><td>${mcounts[m]}</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
    }

    // Fee type breakdown table if available
    if (result.simulation && result.simulation.feeTypeCounts) {
        const counts = result.simulation.feeTypeCounts;
        const keys = Object.keys(counts);
        if (keys.length > 0) {
            html += '<h4 style="margin-top:1rem;">Fee Type Breakdown</h4>';
            html += '<div class="table-container"><table class="data-table"><thead><tr><th>Fee Type</th><th>Count</th></tr></thead><tbody>';
            keys.forEach(k => {
                html += `<tr><td>${k.replace(/_/g,' ')}</td><td>${counts[k]}</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
    }

    if (result.errors && result.errors.length > 0) {
        html += '<div class="alert alert-danger" style="margin-top: 1rem;"><strong>Errors Found:</strong><ul>';
        result.errors.slice(0, 10).forEach(err => {
            html += `<li>${typeof err === 'string' ? err : (err.message || err)}</li>`;
        });
        if (result.errors.length > 10) html += `<li>... and ${result.errors.length - 10} more errors</li>`;
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
        
        let response;
        
        // Handle Etsy Statement import (file upload)
        if (currentImportType === 'etsy-statement') {
            // Validate file presence to avoid 400 errors from backend
            if (!csvFileInput.files || csvFileInput.files.length === 0) {
                alert('Please select a CSV file to import.');
                executeBtn.disabled = false;
                executeBtn.textContent = '✅ Execute Import';
                return;
            }
            const formData = new FormData();
            formData.append('file', csvFileInput.files[0]);
            
            // Add month if specified
            const monthInput = document.getElementById('statementMonth');
            if (monthInput && monthInput.value) {
                formData.append('month', monthInput.value);
            }
            
            response = await fetch('/api/import/etsy-statement/execute', {
                method: 'POST',
                body: formData
            });
        } else {
            // Handle other imports (JSON data)
            const mappedData = csvData.map(row => {
                const mapped = {};
                Object.keys(columnMap).forEach(field => {
                    const csvColumn = columnMap[field];
                    mapped[field] = row[csvColumn];
                });
                return mapped;
            });
            
            let endpoint = '/api/products/import/execute';
            if (currentImportType === 'materials') endpoint = '/api/materials/import/execute';
            if (currentImportType === 'sku-mapping') endpoint = '/api/etsy/mappings/import/execute';
            
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    data: mappedData,
                    mode: importModeSelect.value
                })
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            displayImportResults(result);
            resetUIAfterImport();
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Check if it's a month-already-exists error
            if (result.monthExists) {
                alert(`⚠️ ${result.error}\n\nClear this month's fees first if you want to re-import.`);
            } else if (result.multiMonth && result.monthOptions) {
                const months = Object.entries(result.monthOptions).map(([m,c]) => `${m} (${c} rows)`).join('\n');
                alert(`⚠️ Multiple months detected.\n\n${months}\n\nPlease select a month from the picker and run Execute again.`);
                const monthInput = document.getElementById('statementMonth');
                if (monthInput) {
                    const firstMonth = Object.keys(result.monthOptions)[0];
                    if (firstMonth) monthInput.value = firstMonth;
                    monthInput.focus();
                }
            } else {
                alert('❌ Import failed: ' + (result.error || 'Unknown error'));
            }
        }
    } catch (error) {
        alert('❌ Error during import: ' + error.message);
    } finally {
        executeBtn.disabled = false;
        executeBtn.textContent = '✅ Execute Import';
    }
}

function resetUIAfterImport() {
    // Clear file input
    if (csvFileInput) csvFileInput.value = '';
    if (fileNameSpan) fileNameSpan.textContent = 'No file selected';
    
    // Clear month input for etsy-statement
    const monthInput = document.getElementById('statementMonth');
    if (monthInput) monthInput.value = '';
    
    // Clear previous results
    simulationResults.innerHTML = '';
}

async function bulkExecuteImport() {
    if (!confirm('This will import ALL months from the CSV file. Are you sure?')) {
        return;
    }
    
    try {
        bulkExecuteBtn.disabled = true;
        bulkExecuteBtn.textContent = '⏳ Bulk Importing...';
        
        if (!csvFileInput.files || csvFileInput.files.length === 0) {
            alert('Please select a CSV file to import.');
            bulkExecuteBtn.disabled = false;
            bulkExecuteBtn.textContent = '📦 Bulk Import All Months';
            return;
        }
        
        const formData = new FormData();
        formData.append('file', csvFileInput.files[0]);
        
        const response = await fetch('/api/import/etsy-statement/bulk-execute', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayBulkResults(result);
            resetUIAfterImport();
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('❌ Bulk import failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('❌ Error during bulk import: ' + error.message);
    } finally {
        bulkExecuteBtn.disabled = false;
        bulkExecuteBtn.textContent = '📦 Bulk Import All Months';
    }
}

function displayBulkResults(result) {
    const summary = result.summary || {};
    let html = '<div class="stat-grid">';
    html += `<div class="stat-item"><div class="stat-number" style="color: #28a745;">${summary.monthsProcessed || 0}</div><div class="stat-label">Months Processed</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #6c757d;">${summary.monthsSkipped || 0}</div><div class="stat-label">Already Imported</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #007bff;">${summary.totalImported || 0}</div><div class="stat-label">Total Fees Imported</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #fd7e14;">${summary.totalSkipped || 0}</div><div class="stat-label">Shop-Level Skipped</div></div>`;
    html += '</div>';
    
    document.getElementById('resultsStats').innerHTML = html;
    
    let detailsHtml = `<div class="alert alert-info"><strong>Bulk Import Complete</strong><br>${summary.message || ''}</div>`;
    
    // Month-by-month breakdown
    if (result.bulkResults && result.bulkResults.length > 0) {
        detailsHtml += '<h4 style="margin-top:1rem;">Per-Month Results</h4>';
        detailsHtml += '<div class="table-container"><table class="data-table"><thead><tr><th>Month</th><th>Status</th><th>Imported</th><th>Skipped</th><th>Notes</th></tr></thead><tbody>';
        result.bulkResults.forEach(r => {
            const statusBadge = r.status === 'success' ? '<span style="color:#28a745;">✓ Success</span>' : '<span style="color:#6c757d;">⊘ Skipped</span>';
            detailsHtml += `<tr><td><strong>${r.month}</strong></td><td>${statusBadge}</td><td>${r.imported || 0}</td><td>${r.skipped || 0}</td><td>${r.reason || ''}</td></tr>`;
        });
        detailsHtml += '</tbody></table></div>';
    }
    
    document.getElementById('resultsDetails').innerHTML = detailsHtml;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function displayImportResults(result) {
    // Handle both formats: array-based and count-based
    let imported = 0;
    let errors = [];
    let skipped = 0;
    
    if (result.imported !== undefined) {
        // Etsy statement format: { imported: X, errors: [...], message: "...", shopLevelFeesToEnter: {...} }
        imported = result.imported || 0;
        errors = result.errors || [];
        skipped = result.skippedShopLevel || 0;
        
        // Show shop-level fees form if present
        if (result.shopLevelFeesToEnter && Object.keys(result.shopLevelFeesToEnter).length > 0) {
            displayShopLevelFeesForm(result.shopLevelFeesToEnter, result.statementMonth);
        }
    } else {
        // Standard format: { success: [...], errors: [...], skipped: [...] }
        imported = result.success?.length || 0;
        errors = result.errors || [];
        skipped = result.skipped?.length || 0;
    }
    
    let html = '<div class="stat-grid">';
    html += `<div class="stat-item"><div class="stat-number" style="color: #28a745;">${imported}</div><div class="stat-label">Imported</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #6c757d;">${skipped}</div><div class="stat-label">Skipped</div></div>`;
    html += `<div class="stat-item"><div class="stat-number" style="color: #dc3545;">${errors?.length || 0}</div><div class="stat-label">Errors</div></div>`;
    html += '</div>';
    
    document.getElementById('resultsStats').innerHTML = html;
    
    let detailsHtml = '';
    
    // Show completion status
    const errorCount = errors?.length || 0;
    detailsHtml += `<div class="alert alert-info"><strong>Import Complete</strong> | Imported: ${imported}, Skipped: ${skipped}, Errors: ${errorCount}</div>`;
    
    if (errors && errors.length > 0) {
        detailsHtml += '<div class="alert alert-danger"><strong>Errors:</strong><ul>';
        errors.forEach(err => {
            detailsHtml += `<li>${typeof err === 'string' ? err : (err.sku || err.materialId || 'Error')}: ${typeof err === 'string' ? '' : err.error}</li>`;
        });
        detailsHtml += '</ul></div>';
    }
    
    if (imported > 0) {
        detailsHtml += `<div class="alert alert-success">Successfully imported ${imported} records!</div>`;
    }
    
    document.getElementById('resultsDetails').innerHTML = detailsHtml;
}

// removed interactive mapping UI; mapping done via CSV import

// Export unmapped variations
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
        
        const parentNoVariations = data.parent_no_variations || [];
        const variationMissingSku = data.variation_missing_sku || [];
        const total = parentNoVariations.length + variationMissingSku.length;
        
        if (total === 0) {
            alert('No missing SKU issues found!');
            return;
        }
        
        // Create CSV content with Type column
        const headers = ['Type', 'Listing ID', 'Listing Title', 'Variation SKU', 'Quantity', 'Issue'];
        const rows = [];
        
        parentNoVariations.forEach(item => {
            rows.push([
                'Parent',
                item.listing_id,
                `"${(item.title || '').replace(/"/g, '""')}"`,
                item.sku || '',
                item.quantity || 0,
                'Has SKU but marked as no variations'
            ]);
        });
        
        variationMissingSku.forEach(item => {
            rows.push([
                'Variation',
                item.listing_id,
                `"${(item.listing_title || '').replace(/"/g, '""')}"`,
                item.variation_sku || '',
                item.quantity || 0,
                'Missing or invalid SKU'
            ]);
        });
        
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
        
        alert(`Exported ${total} items with missing SKU issues`);
    } catch (error) {
        alert('Error exporting missing SKUs: ' + error.message);
    } finally {
        btnExportMissingSku.disabled = false;
        btnExportMissingSku.textContent = '📤 Export Missing SKUs';
    }
}

// Export listings skipped in pricing calculation
async function exportSkippedPricing() {
    try {
        btnExportSkipped.disabled = true;
        btnExportSkipped.textContent = '⏳ Exporting...';
        
        const response = await fetch('/api/etsy/export/skipped-pricing');
        if (!response.ok) {
            throw new Error('Failed to fetch skipped pricing data');
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            alert('No skipped items found in pricing calculation!');
            return;
        }
        
        // Create CSV content
        const headers = ['Listing ID', 'Listing Title', 'SKU', 'Current Price', 'Has Mapping', 'Master SKU', 'Weight (g)'];
        const rows = data.map(item => [
            item.listing_id,
            `"${(item.title || '').replace(/"/g, '""')}"`,
            item.sku || '',
            item.price || 0,
            item.has_mapping || 'No',
            item.master_sku || '',
            item.weight_grams || ''
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skipped_pricing_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`Exported ${data.length} items skipped in pricing calculation`);
    } catch (error) {
        alert('Error exporting skipped pricing: ' + error.message);
    } finally {
        btnExportSkipped.disabled = false;
        btnExportSkipped.textContent = '📤 Export Skipped (Pricing)';
    }
}

// Shop-Level Fees Manual Entry
function displayShopLevelFeesForm(shopFees, statementMonth) {
    const container = document.getElementById('shopFeesContainer') || createShopFeesContainer();
    
    // Use the provided statement month (detected/provided during import)
    const monthDisplay = statementMonth || new Date().toISOString().slice(0, 7);
    
    let html = `
        <div class="alert alert-warning">
            <strong>⚠️ Shop-Level Fees Require Manual Entry</strong><br>
            The following fees could not be linked to specific orders. Please review and enter the totals:
        </div>
        
        <div class="shop-fees-form">
            <div class="form-group">
                <label>Statement Month:</label>
                <span style="font-weight: bold;">${monthDisplay}</span>
            </div>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Fee Type</th>
                        <th>CSV Total</th>
                        <th>Count</th>
                        <th>Amount to Enter</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>`;
    
    Object.keys(shopFees).forEach(feeType => {
        const fee = shopFees[feeType];
        const displayName = feeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `
            <tr>
                <td><strong>${displayName}</strong></td>
                <td>£${fee.total.toFixed(2)}</td>
                <td>${fee.count}</td>
                <td>
                    <input type="number" step="0.01" value="${fee.total.toFixed(2)}" 
                           class="form-control shop-fee-input" 
                           data-fee-type="${feeType}">
                </td>
                <td>
                    <input type="text" 
                           placeholder="${displayName} - ${monthDisplay}" 
                           class="form-control shop-fee-desc" 
                           data-fee-type="${feeType}">
                </td>
            </tr>`;
    });
    
    html += `
                </tbody>
            </table>
            
            <button id="submitShopFees" class="btn btn-primary">
                💰 Submit Shop-Level Fees
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // Store month for use in submitShopLevelFees
    container.dataset.month = monthDisplay;
    
    document.getElementById('submitShopFees').addEventListener('click', submitShopLevelFees);
}

function createShopFeesContainer() {
    const container = document.createElement('div');
    container.id = 'shopFeesContainer';
    container.className = 'shop-fees-section';
    
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.parentNode.insertBefore(container, resultsSection.nextSibling);
    
    return container;
}

async function submitShopLevelFees() {
    const container = document.getElementById('shopFeesContainer');
    const month = container.dataset.month || document.getElementById('shopFeesMonth')?.value;
    const feeInputs = document.querySelectorAll('.shop-fee-input');
    
    if (!month) {
        alert('Please select a statement month');
        return;
    }
    
    const fees = [];
    feeInputs.forEach(input => {
        const amount = parseFloat(input.value);
        const feeType = input.dataset.feeType;
        const descInput = document.querySelector(`.shop-fee-desc[data-fee-type="${feeType}"]`);
        const description = descInput.value || `${feeType} - ${month}`;
        
        if (amount > 0) {
            fees.push({ fee_type: feeType, amount, description });
        }
    });
    
    if (fees.length === 0) {
        alert('No fees to submit (all amounts are 0)');
        return;
    }
    
    const submitBtn = document.getElementById('submitShopFees');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Submitting...';
    
    try {
        const response = await fetch('/api/import/etsy-statement/manual-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, fees })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`✅ Success! Entered ${result.inserted} shop-level fees for ${month}`);
            document.getElementById('shopFeesContainer').style.display = 'none';
        } else {
            alert('❌ Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('❌ Error submitting fees: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💰 Submit Shop-Level Fees';
    }
}

// Attach event listeners for export buttons
btnExportUnmapped.addEventListener('click', exportUnmapped);
btnExportMissingSku.addEventListener('click', exportMissingSku);
btnExportSkipped.addEventListener('click', exportSkippedPricing);
