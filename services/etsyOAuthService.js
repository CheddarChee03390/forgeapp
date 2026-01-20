// Etsy OAuth Service - Secure OAuth 2.0 PKCE Flow
import db from './database.js';
import crypto from 'crypto';

class EtsyOAuthService {
    constructor() {
        this.clientId = process.env.ETSY_CLIENT_ID || '';
        this.redirectUri = process.env.ETSY_REDIRECT_URI || 'http://localhost:3003/oauth/redirect';
        this.baseUrl = 'https://openapi.etsy.com/v3';
        this.authUrl = 'https://www.etsy.com/oauth/connect';
        this.tokenUrl = 'https://api.etsy.com/v3/public/oauth/token';
    }

    // Generate PKCE challenge/verifier pair
    generatePKCE() {
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
        return { code_verifier: codeVerifier, code_challenge: codeChallenge };
    }

    // Generate OAuth authorization URL with PKCE
    getAuthorizationUrl() {
        if (!this.clientId) {
            throw new Error('ETSY_CLIENT_ID not configured in environment');
        }

        // Generate PKCE challenge
        const pkce = this.generatePKCE();
        const state = crypto.randomBytes(16).toString('hex');

        // Store code_verifier in database with state
        const stmt = db.prepare('INSERT INTO PKCE_Challenges (state, code_verifier, created_at) VALUES (?, ?, ?)');
        stmt.run(state, pkce.code_verifier, Date.now());

        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            scope: 'listings_r listings_w shops_r transactions_r',
            state: state,
            code_challenge: pkce.code_challenge,
            code_challenge_method: 'S256'
        });

        return `${this.authUrl}?${params.toString()}`;
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(code, state) {
        // Retrieve code_verifier from database
        const stmt = db.prepare('SELECT code_verifier FROM PKCE_Challenges WHERE state = ?');
        const row = stmt.get(state);
        
        if (!row) {
            throw new Error('No PKCE challenge found. Please start OAuth flow again.');
        }

        const codeVerifier = row.code_verifier;

        // Clean up old PKCE challenges (older than 10 minutes)
        db.prepare('DELETE FROM PKCE_Challenges WHERE created_at < ?').run(Date.now() - 600000);

        try {
            const body = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.clientId,
                redirect_uri: this.redirectUri,
                code: code,
                code_verifier: codeVerifier
            });

            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: body
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Token exchange failed: ${error}`);
            }

            const data = await response.json();
            
            // Calculate expiration time
            const expiresAt = Date.now() + (data.expires_in * 1000);
            
            // Save tokens securely
            this.saveTokens({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: expiresAt
            });

            // Fetch and save shop ID
            await this.fetchAndSaveShopId(data.access_token);

            // Delete used PKCE challenge
            db.prepare('DELETE FROM PKCE_Challenges WHERE state = ?').run(state);

            return data;
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            throw error;
        }
    }

    // Fetch shop ID and save
    async fetchAndSaveShopId(accessToken) {
        try {
            console.log('🔍 Fetching shop ID...');
            console.log(`📌 Using access token: ${accessToken.substring(0, 20)}...`);
            console.log(`📌 Client ID: ${this.clientId}`);
            console.log(`📌 Base URL: ${this.baseUrl}`);
            
            const response = await fetch(`${this.baseUrl}/application/users/me`, {
                headers: {
                    'x-api-key': this.clientId,
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            console.log(`📌 User endpoint response status: ${response.status}`);
            
            if (response.ok) {
                const userData = await response.json();
                console.log(`📌 User data:`, userData);
                const userId = userData.user_id;
                console.log(`✅ Got user ID: ${userId}`);

                // Fetch shops
                const shopsResponse = await fetch(`${this.baseUrl}/application/users/${userId}/shops`, {
                    headers: {
                        'x-api-key': this.clientId,
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                console.log(`📌 Shops endpoint response status: ${shopsResponse.status}`);
                
                if (shopsResponse.ok) {
                    const shopsData = await shopsResponse.json();
                    console.log(`📌 Shops data:`, shopsData);
                    
                    // Handle both single object and array responses
                    let shopId = null;
                    if (shopsData.shop_id) {
                        // Single shop object
                        shopId = shopsData.shop_id;
                    } else if (shopsData.results && shopsData.results.length > 0) {
                        // Array of shops
                        shopId = shopsData.results[0].shop_id;
                    }
                    
                    if (shopId) {
                        console.log(`✅ Got shop ID: ${shopId}`);
                        // Ensure shopId is an integer
                        this.updateShopId(parseInt(shopId, 10));
                    } else {
                        console.log('⚠️ No shop ID found in response');
                    }
                } else {
                    const errorText = await shopsResponse.text();
                    console.error('❌ Failed to fetch shops:', shopsResponse.status, errorText);
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to fetch user:', response.status, errorText);
            }
        } catch (error) {
            console.error('❌ Error fetching shop ID:', error.message, error);
        }
    }

    // Save tokens to database (encrypted)
    saveTokens({ accessToken, refreshToken, expiresAt }) {
        const now = Date.now();
        
        console.log(`💾 saveTokens called`);
        console.log(`   - Access token length: ${accessToken.length}`);
        console.log(`   - Refresh token length: ${refreshToken.length}`);
        console.log(`   - Expires at: ${new Date(expiresAt).toISOString()}`);
        
        // Simple XOR encryption (for production, use proper encryption)
        const encryptedAccess = this.encrypt(accessToken);
        const encryptedRefresh = this.encrypt(refreshToken);

        console.log(`   - Encrypted access length: ${encryptedAccess.length}`);
        console.log(`   - Encrypted refresh length: ${encryptedRefresh.length}`);

        // Check if row exists to preserve shop_id
        const existing = db.prepare('SELECT id, shop_id FROM OAuth_Tokens WHERE id = 1').get();
        const preservedShopId = existing?.shop_id || null;
        
        console.log(`   - Preserving shop_id: ${preservedShopId}`);
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO OAuth_Tokens (
                id, access_token, refresh_token, expires_at, shop_id, created_at, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(encryptedAccess, encryptedRefresh, expiresAt, preservedShopId, now, now);
        console.log(`✅ Tokens saved to DB (rows changed: ${result.changes})`);
    }

    // Update shop ID
    updateShopId(shopId) {
        console.log(`💾 updateShopId called with shopId: ${shopId}`);
        
        // First check if record exists
        const checkStmt = db.prepare('SELECT id, shop_id FROM OAuth_Tokens WHERE id = 1');
        const existing = checkStmt.get();
        console.log(`   - Existing record before update:`, existing);
        
        const stmt = db.prepare('UPDATE OAuth_Tokens SET shop_id = ?, updated_at = ? WHERE id = 1');
        const result = stmt.run(shopId, Date.now());
        console.log(`   - Update result (rows changed: ${result.changes})`);
        
        // Verify update
        const verifyStmt = db.prepare('SELECT id, shop_id FROM OAuth_Tokens WHERE id = 1');
        const verified = verifyStmt.get();
        console.log(`   - Record after update:`, verified);
    }

    // Get stored tokens
    getStoredTokens() {
        const stmt = db.prepare('SELECT * FROM OAuth_Tokens WHERE id = 1');
        const row = stmt.get();
        
        if (!row) {
            console.log('⚠️ No tokens found in database');
            return null;
        }

        console.log(`🔐 Retrieved tokens - Shop ID: ${row.shop_id}, Expires: ${new Date(row.expires_at).toISOString()}`);
        
        return {
            accessToken: this.decrypt(row.access_token),
            refreshToken: this.decrypt(row.refresh_token),
            expiresAt: row.expires_at,
            shopId: row.shop_id
        };
    }

    // Check if token is valid
    isTokenValid() {
        const tokens = this.getStoredTokens();
        if (!tokens) return false;
        
        // Check if token expires in next 5 minutes
        return tokens.expiresAt > (Date.now() + 300000);
    }

    // Refresh access token
    async refreshAccessToken() {
        const tokens = this.getStoredTokens();
        if (!tokens || !tokens.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: this.clientId,
                refresh_token: tokens.refreshToken
            });

            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: body
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Token refresh failed: ${error}`);
            }

            const data = await response.json();
            const expiresAt = Date.now() + (data.expires_in * 1000);

            this.saveTokens({
                accessToken: data.access_token,
                refreshToken: data.refresh_token || tokens.refreshToken,
                expiresAt: expiresAt
            });

            return data.access_token;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    }

    // Get valid access token (refreshes if needed)
    async getValidAccessToken() {
        if (this.isTokenValid()) {
            const tokens = this.getStoredTokens();
            return tokens.accessToken;
        }

        return await this.refreshAccessToken();
    }

    // Get shop ID
    getShopId() {
        const tokens = this.getStoredTokens();
        return tokens?.shopId || null;
    }

    // Check if authenticated
    isAuthenticated() {
        const tokens = this.getStoredTokens();
        return Boolean(tokens && tokens.accessToken);
    }

    // Clear stored tokens (logout)
    clearTokens() {
        db.exec('DELETE FROM OAuth_Tokens');
    }

    // Simple encryption (for production use proper crypto library)
    encrypt(text) {
        if (!text) return null;
        // In production, use a proper encryption library with env-based key
        return Buffer.from(text).toString('base64');
    }

    decrypt(encrypted) {
        if (!encrypted) return null;
        // Check if it looks like it's already decrypted (plain text token)
        // Etsy tokens start with shopID.xxxxx pattern
        if (encrypted.includes('.') && /^\d+\./.test(encrypted)) {
            return encrypted;  // Already in plaintext
        }
        // Otherwise try to base64 decode
        try {
            return Buffer.from(encrypted, 'base64').toString('utf8');
        } catch (e) {
            // If decoding fails, assume it's already plaintext
            return encrypted;
        }
    }
}

export default new EtsyOAuthService();
