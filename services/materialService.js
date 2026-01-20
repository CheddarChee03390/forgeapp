// Material Service - Data access and business operations for materials
import db from './database.js';
import { Material } from '../models/material.js';

class MaterialService {
    getAll() {
        const stmt = db.prepare('SELECT * FROM Materials ORDER BY materialId');
        return stmt.all();
    }

    getById(materialId) {
        const stmt = db.prepare('SELECT * FROM Materials WHERE materialId = ?');
        return stmt.get(materialId);
    }

    create(materialData) {
        const material = new Material(materialData);
        const validation = material.validate();
        
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        // Check for duplicate MaterialID
        const existing = this.getById(material.materialId);
        if (existing) {
            throw new Error(`Material with ID '${material.materialId}' already exists`);
        }

        const stmt = db.prepare(
            'INSERT INTO Materials (materialId, name, costPerGram, sellPricePerGram) VALUES (?, ?, ?, ?)'
        );
        stmt.run(material.materialId, material.name, material.costPerGram, material.sellPricePerGram || 0);

        return this.getById(material.materialId);
    }

    update(materialId, updates) {
        const existing = this.getById(materialId);
        if (!existing) {
            throw new Error(`Material '${materialId}' not found`);
        }

        // Prevent changing MaterialID (immutable)
        if (updates.materialId && updates.materialId !== materialId) {
            throw new Error('MaterialID cannot be changed');
        }

        const updatedData = { ...existing, ...updates };
        const material = new Material(updatedData);
        const validation = material.validate();
        
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        const stmt = db.prepare(
            'UPDATE Materials SET name = ?, costPerGram = ?, sellPricePerGram = ? WHERE materialId = ?'
        );
        stmt.run(material.name, material.costPerGram, material.sellPricePerGram || 0, materialId);

        return this.getById(materialId);
    }

    delete(materialId) {
        const existing = this.getById(materialId);
        if (!existing) {
            throw new Error(`Material '${materialId}' not found`);
        }

        const stmt = db.prepare('DELETE FROM Materials WHERE materialId = ?');
        stmt.run(materialId);

        return true;
    }

    getCostPerGram(materialId) {
        const material = this.getById(materialId);
        return material ? material.costPerGram : 0;
    }

    simulateImport(materialsArray, mode = 'add') {
        const toAdd = [];
        const toUpdate = [];
        const toSkip = [];
        const errors = [];

        materialsArray.forEach((materialData, index) => {
            try {
                const material = new Material(materialData);
                const validation = material.validate();

                if (!validation.valid) {
                    errors.push({
                        row: index + 1,
                        materialId: materialData.materialId,
                        error: validation.errors.join(', ')
                    });
                    return;
                }

                const existing = this.getById(material.materialId);

                if (existing) {
                    if (mode === 'add') {
                        toSkip.push({ row: index + 1, materialId: material.materialId, reason: 'Already exists' });
                    } else if (mode === 'update' || mode === 'both') {
                        toUpdate.push({ row: index + 1, materialId: material.materialId, changes: material.toJSON() });
                    }
                } else {
                    if (mode === 'add' || mode === 'both') {
                        toAdd.push({ row: index + 1, materialId: material.materialId, data: material.toJSON() });
                    } else if (mode === 'update') {
                        toSkip.push({ row: index + 1, materialId: material.materialId, reason: 'Does not exist' });
                    }
                }
            } catch (error) {
                errors.push({
                    row: index + 1,
                    materialId: materialData.materialId,
                    error: error.message
                });
            }
        });

        return { toAdd, toUpdate, toSkip, errors };
    }

    importMaterials(materialsArray, mode = 'add') {
        const success = [];
        const errors = [];
        const skipped = [];

        materialsArray.forEach((materialData, index) => {
            try {
                console.log(`   Processing row ${index + 1}: ${materialData.materialId}`);

                const material = new Material(materialData);
                const validation = material.validate();

                if (!validation.valid) {
                    console.log(`   ⚠️  Validation failed: ${validation.errors.join(', ')}`);
                    errors.push({
                        row: index + 1,
                        materialId: materialData.materialId,
                        error: validation.errors.join(', ')
                    });
                    return;
                }

                const existing = this.getById(material.materialId);

                if (existing && mode === 'add') {
                    console.log(`   ⏭️  Skipped (exists): ${material.materialId}`);
                    skipped.push({
                        row: index + 1,
                        materialId: material.materialId,
                        reason: 'Already exists'
                    });
                } else if (existing && (mode === 'update' || mode === 'both')) {
                    this.update(material.materialId, material.toJSON());
                    console.log(`   ✅ Updated: ${material.materialId}`);
                    success.push({
                        row: index + 1,
                        materialId: material.materialId,
                        action: 'updated'
                    });
                } else if (!existing && (mode === 'add' || mode === 'both')) {
                    this.create(material.toJSON());
                    console.log(`   ✅ Created: ${material.materialId}`);
                    success.push({
                        row: index + 1,
                        materialId: material.materialId,
                        action: 'created'
                    });
                } else {
                    console.log(`   ⏭️  Skipped (mode mismatch): ${material.materialId}`);
                    skipped.push({
                        row: index + 1,
                        materialId: material.materialId,
                        reason: 'Mode does not allow this operation'
                    });
                }
            } catch (error) {
                console.error(`   ❌ Error on row ${index + 1} (${materialData.materialId}):`, error.message);
                errors.push({
                    row: index + 1,
                    materialId: materialData.materialId,
                    error: error.message
                });
            }
        });

        console.log(`📋 Import Results:`);
        console.log(`   ✅ Success: ${success.length}`);
        console.log(`   ❌ Errors: ${errors.length}`);
        console.log(`   ⏭️  Skipped: ${skipped.length}`);

        return { success, errors, skipped };
    }
}

export default new MaterialService();
