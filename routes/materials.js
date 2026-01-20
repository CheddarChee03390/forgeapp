// Materials API Routes
import express from 'express';
import materialService from '../services/materialService.js';
import costHistoryService from '../services/costHistoryService.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { validateMaterial } from '../utils/validators.js';

const router = express.Router();

// Get all materials
router.get('/', asyncHandler(async (req, res) => {
    const materials = materialService.getAll();
    res.json(materials);
}));

// Get single material
router.get('/:materialId', asyncHandler(async (req, res) => {
    const material = materialService.getById(req.params.materialId);
    if (!material) {
        throw new NotFoundError('Material not found');
    }
    res.json(material);
}));

// Create material
router.post('/', asyncHandler(async (req, res) => {
    const { valid, errors } = validateMaterial(req.body);
    if (!valid) {
        throw new ValidationError('Invalid material data', errors);
    }
    
    console.log(`📦 Creating material: ${req.body.name}`);
    const material = materialService.create(req.body);
    console.log(`✅ Material created`);
    res.status(201).json(material);
}));

// Update material
router.put('/:materialId', asyncHandler(async (req, res) => {
    const { valid, errors } = validateMaterial(req.body);
    if (!valid) {
        throw new ValidationError('Invalid material data', errors);
    }
    
    // Get current material to check for cost changes
    const currentMaterial = materialService.getById(req.params.materialId);
    if (!currentMaterial) {
        throw new NotFoundError('Material not found');
    }
    
    // Update material in Materials table
    const updatedMaterial = materialService.update(req.params.materialId, req.body);
    
    // If costPerGram changed, log it to Material_Costs history
    if (req.body.costPerGram !== undefined) {
        const newCost = parseFloat(req.body.costPerGram);
        const oldCost = parseFloat(currentMaterial.costPerGram);
        
        if (newCost !== oldCost) {
            const reason = req.body.changeReason || 'Updated via materials endpoint';
            costHistoryService.updateMaterialCost(
                req.params.materialId,
                newCost,
                reason
            );
        }
    }
    
    res.json(updatedMaterial);
}));

// Delete material
router.delete('/:materialId', asyncHandler(async (req, res) => {
    materialService.delete(req.params.materialId);
    res.status(204).send();
}));

// Simulate material import
router.post('/import/simulate', asyncHandler(async (req, res) => {
    console.log(`🔍 Simulating material import: ${req.body.data?.length || 0} materials`);
    const result = materialService.simulateImport(req.body.data, req.body.mode);
    console.log(`📊 Simulation complete: ${result.toAdd?.length || 0} to add, ${result.toUpdate?.length || 0} to update`);
    res.json(result);
}));

// Execute material import
router.post('/import/execute', (req, res) => {
    try {
        console.log(`🚀 Executing material import: ${req.body.data?.length || 0} materials`);
        const result = materialService.importMaterials(req.body.data, req.body.mode);
        console.log(`✅ Import complete: ${result.success?.length || 0} imported, ${result.errors?.length || 0} errors`);
        res.json(result);
    } catch (error) {
        console.error(`❌ Material import failed:`, error.message);
        res.status(400).json({ error: error.message });
    }
});

export default router;
