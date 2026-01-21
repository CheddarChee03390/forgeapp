// Express Server - Main application entry point
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import materialRoutes from './routes/materials.js';
import productRoutes from './routes/products.js';
import etsyRoutes from './routes/etsy.js';
import oauthRoutes from './routes/oauth.js';
import pricingRoutes from './routes/pricing.js';
import maintenanceRoutes from './routes/maintenance.js';
import salesRoutes from './routes/sales.js';
import importRoutes from './routes/import.js';
import reportsRoutes from './routes/reports.js';
import costsRoutes from './routes/costs.js';
import debugRoutes from './routes/debug.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import { backupOnStartup, scheduleDailyBackups } from './utils/backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/materials', materialRoutes);
app.use('/api/products', productRoutes);
app.use('/api/etsy', etsyRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/import', importRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/costs', costsRoutes);
app.use('/api/debug', debugRoutes);
app.use('/oauth', oauthRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Add health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Forge App running on http://localhost:${PORT}`);
    console.log(`📦 Master Stock Management System`);
    console.log(`💾 SQLite Database: ${path.join(__dirname, 'data', 'forge.db')}`);
    
    // Initialize backup system
    console.log(`\n🔐 Initializing backup system...`);
    backupOnStartup();
    scheduleDailyBackups();
});
