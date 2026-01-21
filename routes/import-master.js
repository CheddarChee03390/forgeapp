// Master SKU CSV Import Routes
import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import csv from 'csv-parser';
import db from '../services/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/import/master-csv
 * Import orders from master SKU CSV file
 */
router.post('/master-csv', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (!req.file.originalname.endsWith('.csv')) {
        return res.status(400).json({ success: false, error: 'File must be CSV format' });
    }

    const orders = [];
    const errors = [];

    try {
        // Parse CSV
        await new Promise((resolve, reject) => {
            Readable.from([req.file.buffer])
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        // Validate required fields
                        const required = ['order_id', 'sku', 'product_name', 'quantity', 'sale_price', 'material_cost_at_sale', 'order_date', 'status'];
                        for (const field of required) {
                            if (!row[field]) {
                                throw new Error(`Missing required field: ${field}`);
                            }
                        }

                        orders.push({
                            order_id: String(row.order_id).trim(),
                            sku: String(row.sku).trim(),
                            product_name: String(row.product_name).trim(),
                            quantity: parseInt(row.quantity) || 1,
                            sale_price: parseFloat(row.sale_price) || 0,
                            material_cost_at_sale: parseFloat(row.material_cost_at_sale) || 0,
                            order_date: row.order_date.trim(),
                            status: String(row.status).trim() || 'pending'
                        });
                    } catch (error) {
                        errors.push({ row: row.order_id || 'unknown', error: error.message });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (orders.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid orders found',
                errors
            });
        }

        // Insert orders into database
        let successful = 0;
        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO Sales (order_id, sku, product_name, quantity, sale_price, material_cost_at_sale, order_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertTransaction = db.transaction((orderList) => {
            for (const order of orderList) {
                try {
                    insertStmt.run(
                        order.order_id,
                        order.sku,
                        order.product_name,
                        order.quantity,
                        order.sale_price,
                        order.material_cost_at_sale,
                        order.order_date,
                        order.status
                    );
                    successful++;
                } catch (error) {
                    errors.push({ row: order.order_id, error: error.message });
                }
            }
        });

        insertTransaction(orders);

        // Check for material lookup warnings
        const warnings = [];
        const ordersWithMissingMaterials = db.prepare(`
            SELECT s.order_id, s.sku
            FROM Sales s
            LEFT JOIN Materials m ON s.sku = m.sku
            WHERE m.sku IS NULL AND s.order_id IN (${orders.map(() => '?').join(',')})
        `).all(...orders.map(o => o.order_id));

        if (ordersWithMissingMaterials.length > 0) {
            warnings.push({
                type: 'missing_materials',
                count: ordersWithMissingMaterials.length,
                message: `${ordersWithMissingMaterials.length} orders have SKUs not in Materials table`
            });
        }

        res.json({
            success: true,
            imported: successful,
            total: orders.length,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        });

    } catch (error) {
        console.error('❌ Import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

export default router;
