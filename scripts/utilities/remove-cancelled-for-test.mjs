#!/usr/bin/env node
/**
 * Remove just the cancelled order 3664474997 to test API validation
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/forge.db');
const db = new Database(dbPath);

console.log('🗑️  Removing cancelled order 3664474997 for testing...\n');

const result = db.prepare('DELETE FROM Sales WHERE order_id LIKE ?').run('%3664474997%');

console.log(`✓ Deleted ${result.changes} order(s)`);

db.close();
