#!/usr/bin/env node
/**
 * Clear all Etsy orders from database for testing
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

console.log('🗑️  Clearing all Etsy orders from database...\n');

const result = db.prepare('DELETE FROM Sales WHERE order_id LIKE ?').run('etsy-%');

console.log(`✓ Deleted ${result.changes} order(s)`);

db.close();
