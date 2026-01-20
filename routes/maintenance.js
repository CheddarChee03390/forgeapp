// Health & Maintenance Endpoints
// Exposes backup and system health information

import express from 'express';
import {
  createBackup,
  listBackups,
  getBackupStats,
  cleanupOldBackups
} from '../utils/backup.js';

const router = express.Router();

// Get system health status
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform
  });
});

// List all backups
router.get('/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.json({
      success: true,
      count: backups.length,
      backups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get backup statistics
router.get('/backups/stats', (req, res) => {
  try {
    const stats = getBackupStats();
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a manual backup
router.post('/backups/create', (req, res) => {
  try {
    const backup = createBackup();
    if (backup) {
      res.json({
        success: true,
        message: 'Backup created successfully',
        backup
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Backup creation failed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup old backups
router.post('/backups/cleanup', (req, res) => {
  try {
    const result = cleanupOldBackups();
    res.json({
      success: true,
      message: `Cleanup complete: ${result.deletedCount} backups deleted`,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
