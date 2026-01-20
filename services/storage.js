// Storage Service - JSON file-based persistence
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

class Storage {
    constructor(filename) {
        this.filepath = join(DATA_DIR, filename);
        this.data = this.load();
    }

    load() {
        if (!existsSync(this.filepath)) {
            return [];
        }
        try {
            const content = readFileSync(this.filepath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`Error loading ${this.filepath}:`, error.message);
            return [];
        }
    }

    save() {
        try {
            writeFileSync(this.filepath, JSON.stringify(this.data, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error(`Error saving ${this.filepath}:`, error.message);
            return false;
        }
    }

    getAll() {
        return [...this.data];
    }

    findById(id, idField = 'id') {
        return this.data.find(item => item[idField] === id);
    }

    create(item) {
        this.data.push(item);
        this.save();
        return item;
    }

    update(id, updates, idField = 'id') {
        const index = this.data.findIndex(item => item[idField] === id);
        if (index === -1) return null;
        
        this.data[index] = { ...this.data[index], ...updates };
        this.save();
        return this.data[index];
    }

    delete(id, idField = 'id') {
        const index = this.data.findIndex(item => item[idField] === id);
        if (index === -1) return false;
        
        this.data.splice(index, 1);
        this.save();
        return true;
    }

    replaceAll(newData) {
        this.data = newData;
        this.save();
        return this.data;
    }
}

export default Storage;
