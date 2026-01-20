// Automated Database Backup System
// Creates and manages daily backups with retention policy

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'forge.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const RETENTION_DAYS = 7; // Keep backups for 7 days

// Ensure backup directory exists
export function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
}

// Generate backup filename with timestamp
function getBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  return `forge_${timestamp}_${time}.db`;
}

// Create a single backup
export function createBackup() {
  try {
    ensureBackupDir();
    
    // Check if source database exists
    if (!fs.existsSync(DB_PATH)) {
      console.warn(`⚠️ Database not found at ${DB_PATH}, skipping backup`);
      return null;
    }
    
    const backupFilename = getBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath);
    
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`✅ Backup created: ${backupFilename} (${sizeMB} MB)`);
    
    return {
      filename: backupFilename,
      path: backupPath,
      size: stats.size,
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    return null;
  }
}

// Clean up old backups based on retention policy
export function cleanupOldBackups() {
  try {
    ensureBackupDir();
    
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    let deletedCount = 0;
    let deletedSize = 0;
    
    files.forEach((file) => {
      if (!file.startsWith('forge_') || !file.endsWith('.db')) {
        return; // Skip non-backup files
      }
      
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const ageMs = now - stats.mtime.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      
      if (ageDays > RETENTION_DAYS) {
        fs.unlinkSync(filePath);
        deletedCount++;
        deletedSize += stats.size;
        console.log(`🗑️ Deleted old backup: ${file} (${(ageDays).toFixed(1)} days old)`);
      }
    });
    
    if (deletedCount > 0) {
      const deletedMB = (deletedSize / 1024 / 1024).toFixed(2);
      console.log(`🧹 Cleanup complete: ${deletedCount} backups deleted, freed ${deletedMB} MB`);
    }
    
    return {
      deletedCount,
      deletedSize,
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`❌ Cleanup failed: ${error.message}`);
    return null;
  }
}

// List all available backups
export function listBackups() {
  try {
    ensureBackupDir();
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('forge_') && f.endsWith('.db'))
      .sort()
      .reverse(); // Most recent first
    
    const backups = files.map((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      return {
        filename: file,
        size: stats.size,
        sizeMB: parseFloat(sizeMB),
        created: stats.mtime,
        ageDays: parseFloat(ageDays.toFixed(1))
      };
    });
    
    return backups;
  } catch (error) {
    console.error(`❌ Failed to list backups: ${error.message}`);
    return [];
  }
}

// Get backup statistics
export function getBackupStats() {
  try {
    const backups = listBackups();
    
    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null
      };
    }
    
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    
    return {
      totalBackups: backups.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldestBackup: backups[backups.length - 1],
      newestBackup: backups[0],
      averageAge: (backups.reduce((sum, b) => sum + b.ageDays, 0) / backups.length).toFixed(1)
    };
  } catch (error) {
    console.error(`❌ Failed to get stats: ${error.message}`);
    return null;
  }
}

// Schedule automated backups (run daily at 2 AM)
export function scheduleDailyBackups() {
  const performBackup = () => {
    console.log('\n🔄 Running scheduled backup...');
    const backup = createBackup();
    if (backup) {
      cleanupOldBackups();
    }
  };
  
  // Calculate time until next 2 AM
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);
  
  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }
  
  const timeUntilBackup = next2AM.getTime() - now.getTime();
  const hoursUntilBackup = (timeUntilBackup / (1000 * 60 * 60)).toFixed(1);
  
  console.log(`⏰ Next backup scheduled in ${hoursUntilBackup} hours (at 2:00 AM)`);
  
  // Schedule first backup
  setTimeout(() => {
    performBackup();
    // Then repeat daily (24 hours)
    setInterval(performBackup, 24 * 60 * 60 * 1000);
  }, timeUntilBackup);
}

// One-time backup on startup
export function backupOnStartup() {
  console.log('📦 Creating startup backup...');
  createBackup();
}

export default {
  createBackup,
  cleanupOldBackups,
  listBackups,
  getBackupStats,
  scheduleDailyBackups,
  backupOnStartup,
  ensureBackupDir
};
