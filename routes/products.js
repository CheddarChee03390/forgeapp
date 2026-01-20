// Products API Routes
import express from 'express';
import productService from '../services/productService.js';
import { Product } from '../models/product.js';
import { asyncHandler, ApiError, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { validateProduct } from '../utils/validators.js';

const router = express.Router();

// Get all products with calculations
router.get('/', asyncHandler(async (req, res) => {
    const products = productService.getAllWithCalculations();
    res.json(products);
}));

// Get single product with calculations
router.get('/:sku', asyncHandler(async (req, res) => {
    const product = productService.getByIdWithCalculations(req.params.sku);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    res.json(product);
}));

// Create product
router.post('/', asyncHandler(async (req, res) => {
    const { valid, errors } = validateProduct(req.body);
    if (!valid) {
        throw new ValidationError('Invalid product data', errors);
    }
    
    console.log(`📦 Creating product: ${req.body.sku}`);
    const product = productService.create(req.body);
    console.log(`✅ Product created: ${product.SKU}`);
    res.status(201).json(product);
}));

// Update product
router.put('/:sku', asyncHandler(async (req, res) => {
    const { valid, errors } = validateProduct(req.body);
    if (!valid) {
        throw new ValidationError('Invalid product data', errors);
    }
    
    console.log(`📝 Updating product: ${req.params.sku}`);
    const product = productService.update(req.params.sku, req.body);
    console.log(`✅ Product updated: ${product.SKU}`);
    res.json(product);
}));

// Delete product
router.delete('/:sku', asyncHandler(async (req, res) => {
    console.log(`🗑️  Deleting product: ${req.params.sku}`);
    productService.delete(req.params.sku);
    console.log(`✅ Product deleted: ${req.params.sku}`);
    res.status(204).send();
}));

// Simulate import
router.post('/import/simulate', (req, res) => {
    try {
        // Support both old format {products: []} and new format {data: [], mode: ''}
        const products = req.body.products || req.body.data;
        const mode = req.body.mode || 'add';
        
        console.log(`📊 Import Simulation: ${products?.length || 0} products (mode: ${mode})`);
        
        if (!Array.isArray(products)) {
            console.error('❌ Import simulation failed: Products must be an array');
            return res.status(400).json({ error: 'Products must be an array' });
        }
        
        // For new import system, use mode-aware simulation
        if (req.body.mode) {
            const toAdd = [];
            const toUpdate = [];
            const toSkip = [];
            const errors = [];
            
            products.forEach((productData, index) => {
                try {
                    const existing = productService.getById(productData.sku);
                    const product = new Product(productData);
                    const validation = product.validate();
                    
                    if (!validation.valid) {
                        errors.push({ row: index + 1, sku: productData.sku, error: validation.errors.join(', ') });
                        return;
                    }
                    
                    if (existing) {
                        if (mode === 'add') {
                            toSkip.push({ row: index + 1, sku: productData.sku });
                        } else {
                            toUpdate.push({ row: index + 1, sku: productData.sku });
                        }
                    } else {
                        if (mode === 'update') {
                            toSkip.push({ row: index + 1, sku: productData.sku });
                        } else {
                            toAdd.push({ row: index + 1, sku: productData.sku });
                        }
                    }
                } catch (error) {
                    errors.push({ row: index + 1, sku: productData.sku, error: error.message });
                }
            });
            
            console.log(`✅ Simulation complete: ${toAdd.length} to add, ${toUpdate.length} to update, ${toSkip.length} to skip, ${errors.length} errors`);
            return res.json({ toAdd, toUpdate, toSkip, errors });
        }
        
        // Old format - use existing simulation
        const simulation = productService.simulateImport(products);
        const valid = simulation.filter(s => s.valid).length;
        const invalid = simulation.filter(s => !s.valid).length;
        console.log(`✅ Simulation complete: ${valid} valid, ${invalid} invalid`);
        
        res.json(simulation);
    } catch (error) {
        console.error('❌ Import simulation error:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: error.message });
    }
});

// Execute import
router.post('/import/execute', (req, res) => {
    try {
        // Support both old format {products: [], replaceAll: bool} and new format {data: [], mode: ''}
        const products = req.body.products || req.body.data;
        const mode = req.body.mode;
        const replaceAll = req.body.replaceAll || (mode === 'both' || mode === 'update');
        
        console.log(`\n🚀 Starting Import Execution`);
        console.log(`   Products: ${products?.length || 0}`);
        console.log(`   Mode: ${mode || 'legacy'}`);
        console.log(`   Replace existing: ${replaceAll}`);
        
        if (!Array.isArray(products)) {
            console.error('❌ Import failed: Products must be an array');
            return res.status(400).json({ error: 'Products must be an array' });
        }
        
        const results = productService.importProducts(products, replaceAll);
        
        console.log(`\n📋 Import Results:`);
        console.log(`   ✅ Success: ${results.success.length}`);
        console.log(`   ❌ Errors: ${results.errors.length}`);
        console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
        
        if (results.errors.length > 0) {
            console.log(`\n❌ Import Errors:`);
            results.errors.forEach(err => {
                console.log(`   Row ${err.row} (${err.sku}): ${err.errors.join(', ')}`);
            });
        }
        
        res.json(results);
    } catch (error) {
        console.error('\n💥 Import execution fatal error:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: error.message });
    }
});

export default router;
