// Product Service - Data access and business operations for master stock
import db from './database.js';
import { Product } from '../models/product.js';
import { Calculator } from '../models/calculator.js';
import materialService from './materialService.js';

class ProductService {
    getAll() {
        const stmt = db.prepare('SELECT * FROM Master_Skus ORDER BY SKU');
        return stmt.all();
    }

    getAllWithCalculations() {
        const products = this.getAll();
        return products.map(p => this.enrichWithCalculations(p));
    }

    getById(sku) {
        const stmt = db.prepare('SELECT * FROM Master_Skus WHERE SKU = ?');
        return stmt.get(sku);
    }

    getByIdWithCalculations(sku) {
        const product = this.getById(sku);
        if (!product) return null;
        return this.enrichWithCalculations(product);
    }

    normalizeMaterialName(material) {
        // Normalize material names to match database values
        const materialMap = {
            'silver gold plated': 'Silver gold Plated',
            'silver': 'Silver',
            'gold': 'Gold',
            'bronze': 'Bronze'
        };
        const normalized = materialMap[material.toLowerCase()];
        return normalized || material;
    }

    create(productData) {
        const product = new Product(productData);
        const validation = product.validate();
        
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        // Check for duplicate SKU
        const existing = this.getById(product.sku);
        if (existing) {
            throw new Error(`Product with SKU '${product.sku}' already exists`);
        }

        try {
            const stmt = db.prepare(
                'INSERT INTO Master_Skus (SKU, Type, Length, Weight, Material, postagecost) VALUES (?, ?, ?, ?, ?, ?)'
            );
            stmt.run(
                product.sku,
                product.type,
                product.length,
                product.weight,
                product.material,
                product.postageCost
            );
        } catch (error) {
            console.error(`❌ Database insert error for SKU ${product.sku}:`, error.message);
            throw new Error(`Database error: ${error.message}`);
        }

        return this.getById(product.sku);
    }

    update(sku, updates) {
        const existing = this.getById(sku);
        if (!existing) {
            throw new Error(`Product '${sku}' not found`);
        }

        // Prevent changing SKU (immutable)
        if (updates.sku && updates.sku !== sku) {
            throw new Error('SKU cannot be changed');
        }

        const updatedData = { ...existing, ...updates };
        const product = new Product(updatedData);
        const validation = product.validate();
        
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        const stmt = db.prepare(
            'UPDATE Master_Skus SET Type = ?, Length = ?, Weight = ?, Material = ?, postagecost = ? WHERE SKU = ?'
        );
        stmt.run(
            product.type,
            product.length,
            product.weight,
            product.material,
            product.postageCost,
            sku
        );

        return this.getById(sku);
    }

    delete(sku) {
        const existing = this.getById(sku);
        if (!existing) {
            throw new Error(`Product '${sku}' not found`);
        }

        const stmt = db.prepare('DELETE FROM Master_Skus WHERE SKU = ?');
        stmt.run(sku);

        return true;
    }

    // Enrich product with material cost
    enrichWithCalculations(product) {
        const costPerGram = materialService.getCostPerGram(product.Material);
        const costOfItem = Calculator.calculateCostOfItem(product.Weight, costPerGram);

        return {
            sku: product.SKU,
            type: product.Type,
            length: product.Length,
            weight: product.Weight,
            material: product.Material,
            postageCost: product.postagecost,
            costPerGram,
            costOfItem
        };
    }

    // Import products from array (for CSV import)
    importProducts(productsArray, replaceAll = false) {
        const results = {
            success: [],
            errors: [],
            skipped: []
        };

        productsArray.forEach((productData, index) => {
            try {
                console.log(`   Processing row ${index + 1}: ${productData.sku}`);
                
                // Normalize material name to match database values
                if (productData.material) {
                    productData.material = this.normalizeMaterialName(productData.material);
                }
                
                const product = new Product(productData);
                const validation = product.validate();
                
                if (!validation.valid) {
                    console.log(`   ⚠️  Validation failed: ${validation.errors.join(', ')}`);
                    results.errors.push({
                        row: index + 1,
                        sku: productData.sku,
                        errors: validation.errors
                    });
                    return;
                }

                const existing = this.getById(product.sku);
                
                if (existing && !replaceAll) {
                    console.log(`   ⏭️  Skipped (exists): ${product.sku}`);
                    results.skipped.push({
                        row: index + 1,
                        sku: product.sku,
                        reason: 'SKU already exists'
                    });
                } else if (existing && replaceAll) {
                    this.update(product.sku, product.toJSON());
                    console.log(`   ✅ Updated: ${product.sku}`);
                    results.success.push({
                        row: index + 1,
                        sku: product.sku,
                        action: 'updated'
                    });
                } else {
                    this.create(product.toJSON());
                    console.log(`   ✅ Created: ${product.sku}`);
                    results.success.push({
                        row: index + 1,
                        sku: product.sku,
                        action: 'created'
                    });
                }
            } catch (error) {
                console.error(`   ❌ Error on row ${index + 1} (${productData.sku}):`, error.message);
                console.error(`      Stack:`, error.stack);
                results.errors.push({
                    row: index + 1,
                    sku: productData.sku,
                    errors: [error.message]
                });
            }
        });

        return results;
    }

    // Simulate import without actually importing
    simulateImport(productsArray) {
        const simulation = [];

        productsArray.forEach((productData, index) => {
            const product = new Product(productData);
            const validation = product.validate();
            
            const existing = this.getById(product.sku);
            const enriched = this.enrichWithCalculations({
                SKU: product.sku,
                Type: product.type,
                Length: product.length,
                Weight: product.weight,
                Material: product.material,
                postagecost: product.postageCost
            });

            simulation.push({
                row: index + 1,
                sku: product.sku,
                action: existing ? 'update' : 'create',
                valid: validation.valid,
                errors: validation.errors,
                data: enriched
            });
        });

        return simulation;
    }
}

export default new ProductService();
