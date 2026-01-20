// Etsy Mappings Service - SKU mapping CRUD and operations
import db from '../database.js';

class MappingsService {
    // Save/overwrite mapping of variation SKU to internal SKU
    saveVariationMapping(variationSku, internalSku) {
        const now = Math.floor(Date.now() / 1000);
        const stmt = db.prepare(`
            INSERT INTO Marketplace_Sku_Map (marketplace, variation_sku, internal_sku, updated_at)
            VALUES ('etsy', ?, ?, ?)
            ON CONFLICT(marketplace, variation_sku)
            DO UPDATE SET internal_sku = excluded.internal_sku, updated_at = excluded.updated_at
        `);
        stmt.run(variationSku, internalSku || null, now);
        return true;
    }

    // List all mappings for Etsy marketplace
    getAllMappings() {
        const stmt = db.prepare(`
            SELECT marketplace, variation_sku, internal_sku, updated_at
            FROM Marketplace_Sku_Map
            WHERE marketplace = 'etsy'
            ORDER BY updated_at DESC, variation_sku ASC
        `);
        return stmt.all();
    }

    // Delete a mapping by variation SKU
    deleteMapping(variationSku) {
        const stmt = db.prepare(`
            DELETE FROM Marketplace_Sku_Map
            WHERE marketplace = 'etsy' AND variation_sku = ?
        `);
        stmt.run(variationSku);
        return true;
    }

    // Simulate CSV import for SKU mappings
    simulateMappingImport(rows, mode = 'both') {
        if (!Array.isArray(rows)) throw new Error('data must be an array');
        const toAdd = [];
        const toUpdate = [];
        const toSkip = [];
        const errors = [];

        const existsStmt = db.prepare(`
            SELECT 1 FROM Marketplace_Sku_Map WHERE marketplace = 'etsy' AND variation_sku = ?
        `);

        rows.forEach((row, idx) => {
            const variation = (row.variation_sku ?? row.variationSku ?? '').toString().trim();
            const internal = (row.internal_sku ?? row.internalSku ?? '').toString().trim();
            if (!variation || !internal) {
                errors.push({ row: idx + 1, error: 'variation_sku and internal_sku are required' });
                return;
            }
            const exists = !!existsStmt.get(variation);
            if (exists) {
                if (mode === 'add') toSkip.push({ row: idx + 1, variation_sku: variation });
                else toUpdate.push({ row: idx + 1, variation_sku: variation });
            } else {
                if (mode === 'update') toSkip.push({ row: idx + 1, variation_sku: variation });
                else toAdd.push({ row: idx + 1, variation_sku: variation });
            }
        });

        return { toAdd, toUpdate, toSkip, errors };
    }

    // Execute CSV import for SKU mappings
    importMappings(rows, mode = 'both') {
        if (!Array.isArray(rows)) throw new Error('data must be an array');
        const result = { success: [], errors: [], skipped: [] };
        const existsStmt = db.prepare(`
            SELECT 1 FROM Marketplace_Sku_Map WHERE marketplace = 'etsy' AND variation_sku = ?
        `);

        rows.forEach((row, idx) => {
            try {
                const variation = (row.variation_sku ?? row.variationSku ?? '').toString().trim();
                const internal = (row.internal_sku ?? row.internalSku ?? '').toString().trim();
                if (!variation || !internal) {
                    result.errors.push({ row: idx + 1, variation_sku: variation, error: 'variation_sku and internal_sku are required' });
                    return;
                }
                const exists = !!existsStmt.get(variation);
                if (exists && mode === 'add') {
                    result.skipped.push({ row: idx + 1, variation_sku: variation });
                    return;
                }
                if (!exists && mode === 'update') {
                    result.skipped.push({ row: idx + 1, variation_sku: variation });
                    return;
                }
                this.saveVariationMapping(variation, internal);
                result.success.push({ row: idx + 1, variation_sku: variation });
            } catch (e) {
                result.errors.push({ row: idx + 1, variation_sku: row?.variation_sku, error: e.message });
            }
        });

        return result;
    }

    // Get unmapped variations (no internal SKU mapping)
    getUnmappedVariations() {
        const stmt = db.prepare(`
            SELECT 
                v.listing_id,
                l.title as listing_title,
                v.variation_sku,
                v.price,
                v.quantity
            FROM Etsy_Variations v
            LEFT JOIN Etsy_Inventory l ON v.listing_id = l.listing_id
            LEFT JOIN Marketplace_Sku_Map m 
              ON m.marketplace = 'etsy' 
              AND m.variation_sku = v.variation_sku
              AND m.is_active = 1
            WHERE m.internal_sku IS NULL
            ORDER BY v.listing_id, v.variation_sku
        `);
        return stmt.all();
    }
}

export default new MappingsService();
