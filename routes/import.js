// CSV Import Routes - Main Router
import express from 'express';
import masterImportRouter from './import-master.js';
import etsyStatementRouter from './import-etsy-statement.js';

const router = express.Router();

// Legacy route for backward compatibility
router.use('/import-csv', masterImportRouter);

// Etsy statement import routes
router.use('/etsy-statement', etsyStatementRouter);

export default router;
