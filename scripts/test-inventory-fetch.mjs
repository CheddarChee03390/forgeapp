import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'forge.db');

const db = new Database(dbPath);

// Get access token
const tokenRow = db.prepare('SELECT access_token, shop_id FROM OAuth_Tokens WHERE id = 1').get();

if (!tokenRow || !tokenRow.access_token) {
    console.log('❌ No access token found');
    process.exit(1);
}

// Decrypt token (it's stored encrypted)
const crypto = await import('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

function decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

const accessToken = decrypt(tokenRow.access_token);

console.log('🔍 Testing inventory fetch for listing 1800659590...\n');

const url = 'https://openapi.etsy.com/v3/application/listings/1800659590/inventory';

const response = await fetch(url, {
    headers: {
        'x-api-key': process.env.ETSY_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
    }
});

console.log(`Status: ${response.status} ${response.statusText}`);

if (response.ok) {
    const data = await response.json();
    console.log('\n📦 Inventory structure:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.products && data.products.length > 0) {
        const product = data.products[0];
        console.log('\n📦 First product:');
        console.log(`  - Has offerings: ${!!product.offerings}`);
        if (product.offerings) {
            console.log(`  - Offerings count: ${product.offerings.length}`);
            if (product.offerings[0]) {
                console.log(`  - First offering:`, JSON.stringify(product.offerings[0], null, 2));
            }
        }
    }
} else {
    const text = await response.text();
    console.log('❌ Error:', text);
}

db.close();
