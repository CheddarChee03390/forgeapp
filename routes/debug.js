import express from 'express';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import etsyClient from '../services/etsy/etsyClient.js';
import salesRepository from '../services/sales/sales.repository.js';
import db from '../services/database.js';

const router = express.Router();

// In-memory guard to prevent casual clicks
const REQUIRED_CONFIRM = 'CONFIRM';

// Fetch a single Etsy receipt by ID (live API)
router.get('/etsy/receipt/:receiptId', asyncHandler(async (req, res) => {
    const { receiptId } = req.params;
    if (!receiptId) throw new ValidationError('receiptId is required');

    const shopId = await etsyClient.getShopId();
    if (!shopId) {
        return res.status(400).json({ error: 'Missing shopId / not authenticated' });
    }

    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts/${receiptId}?includes=Transactions`);
    const data = await etsyClient.etsyFetchWithApiKey(url);
    if (!data) {
        return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json({ success: true, data });
}));

// Clear selected tables (admin only, requires confirm token)
router.post('/clear', asyncHandler(async (req, res) => {
    const { action, confirm } = req.body || {};
    if (confirm !== REQUIRED_CONFIRM) {
        throw new ValidationError('Confirm token missing or incorrect', [`confirm must equal ${REQUIRED_CONFIRM}`]);
    }

    const actions = {
        'sales-and-fees': () => {
            salesRepository.clearAllSales(); // also clears Etsy_Fees inside repository
        },
        'etsy-fees': () => {
            db.prepare('DELETE FROM Etsy_Fees').run();
        },
        'materials': () => {
            db.prepare('DELETE FROM Materials').run();
        },
        'products': () => {
            db.prepare('DELETE FROM Master_Skus').run();
            db.prepare('DELETE FROM Etsy_Inventory').run();
            db.prepare('DELETE FROM Etsy_Variations').run();
            db.prepare('DELETE FROM Marketplace_Sku_Map').run();
        },
        'oauth-tokens': () => {
            db.prepare('DELETE FROM OAuth_Tokens').run();
        }
    };

    const fn = actions[action];
    if (!fn) throw new ValidationError('Invalid action', ['action must be one of: sales-and-fees, etsy-fees, materials, products, oauth-tokens']);

    fn();
    res.json({ success: true, action });
}));

export default router;
