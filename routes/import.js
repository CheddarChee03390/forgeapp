// CSV Import Routes
import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import csv from 'csv-parser';
import db from '../services/database.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Import orders from CSV
router.post('/import-csv', upload.single('file'), asyncHandler(async (req, res) => {
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
                        errors.push(`Row ${orders.length + 1}: ${error.message}`);
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (orders.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No valid orders found in CSV',
                errors: errors 
            });
        }

        // Insert orders into database
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO Sales (order_id, sku, product_name, quantity, sale_price, material_cost_at_sale, order_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertFeeStmt = db.prepare(`
            INSERT INTO Etsy_Fees (order_id, fee_type, amount, description, charged_date)
            VALUES (?, ?, ?, ?, ?)
        `);

        let imported = 0;
        let duplicates = 0;

        db.exec('BEGIN TRANSACTION');

        try {
            for (const order of orders) {
                const result = insertStmt.run(
                    order.order_id,
                    order.sku,
                    order.product_name,
                    order.quantity,
                    order.sale_price,
                    order.material_cost_at_sale,
                    order.order_date,
                    order.status
                );

                if (result.changes > 0) {
                    // Calculate and insert Etsy fees (standard: transaction fee ~5.5% + £0.20 + payment processing ~3%)
                    const subtotal = order.sale_price * order.quantity;
                    const transactionFee = (subtotal * 0.055) + 0.20;
                    const processingFee = subtotal * 0.03;
                    const totalFee = transactionFee + processingFee;

                    insertFeeStmt.run(
                        order.order_id,
                        'etsy_transaction',
                        transactionFee,
                        'Etsy transaction fee (5.5% + £0.20)',
                        order.order_date
                    );

                    insertFeeStmt.run(
                        order.order_id,
                        'payment_processing',
                        processingFee,
                        'Payment processing fee (3%)',
                        order.order_date
                    );

                    imported++;
                } else {
                    duplicates++;
                }
            }

            db.exec('COMMIT');

            console.log(`✅ CSV Import: ${imported} new orders, ${duplicates} duplicates`);

            res.json({
                success: true,
                imported: imported,
                duplicates: duplicates,
                message: `Successfully imported ${imported} orders${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ''}`
            });
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('❌ CSV import error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            errors: errors.slice(0, 5) // Return first 5 errors
        });
    }
}));

export default router;
