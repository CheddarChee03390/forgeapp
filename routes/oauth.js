// OAuth Routes for Etsy Authentication
import express from 'express';
import etsyOAuthService from '../services/etsyOAuthService.js';

const router = express.Router();

// Root OAuth endpoint - show status and provide links
router.get('/', (req, res) => {
    try {
        const isAuthenticated = etsyOAuthService.isAuthenticated();
        const shopId = etsyOAuthService.getShopId();

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etsy OAuth</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .oauth-box {
                        background: rgba(255, 255, 255, 0.1);
                        padding: 40px;
                        border-radius: 12px;
                        backdrop-filter: blur(10px);
                        max-width: 500px;
                        text-align: center;
                    }
                    h1 { margin: 0 0 10px 0; font-size: 2em; }
                    .status { 
                        padding: 15px; 
                        margin: 20px 0; 
                        border-radius: 8px;
                        background: rgba(255, 255, 255, 0.15);
                    }
                    .status.connected { background: rgba(76, 175, 80, 0.3); }
                    .status.disconnected { background: rgba(244, 67, 54, 0.3); }
                    .btn {
                        display: inline-block;
                        padding: 12px 24px;
                        margin: 10px;
                        background: rgba(255, 255, 255, 0.25);
                        color: white;
                        text-decoration: none;
                        border-radius: 6px;
                        transition: background 0.3s;
                        border: none;
                        cursor: pointer;
                        font-size: 1em;
                    }
                    .btn:hover { background: rgba(255, 255, 255, 0.4); }
                    .btn.primary { background: #4CAF50; }
                    .btn.primary:hover { background: #45a049; }
                    .btn.danger { background: #f44336; }
                    .btn.danger:hover { background: #da190b; }
                    p { opacity: 0.9; }
                    .shop-id { font-family: monospace; opacity: 0.8; }
                </style>
            </head>
            <body>
                <div class="oauth-box">
                    <h1>🔐 Etsy OAuth</h1>
                    <div class="status ${isAuthenticated ? 'connected' : 'disconnected'}">
                        ${isAuthenticated 
                            ? `✅ <strong>Connected</strong><br><span class="shop-id">Shop ID: ${shopId}</span>` 
                            : '❌ <strong>Not Connected</strong>'}
                    </div>
                    <p>${isAuthenticated 
                        ? 'Your Etsy account is connected with full access to listings and receipts.' 
                        : 'Connect your Etsy account to enable sales syncing and inventory management.'}</p>
                    <div>
                        <button class="btn primary" onclick="window.location.href='/oauth/authorize'">
                            ${isAuthenticated ? '🔄 Re-authenticate' : '✅ Connect Etsy Account'}
                        </button>
                        ${isAuthenticated ? `<button class="btn danger" onclick="fetch('/oauth/disconnect', {method:'POST'}).then(() => location.reload())">Disconnect</button>` : ''}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('❌ OAuth page error:', error);
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
});

// Get authorization status
router.get('/status', (req, res) => {
    try {
        const isAuthenticated = etsyOAuthService.isAuthenticated();
        const shopId = etsyOAuthService.getShopId();

        res.json({
            authenticated: isAuthenticated,
            shopId: shopId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start OAuth authorization flow
router.get('/authorize', (req, res) => {
    try {
        const authUrl = etsyOAuthService.getAuthorizationUrl();
        res.redirect(authUrl);
    } catch (error) {
        console.error('❌ OAuth authorization error:', error);
        res.status(500).send(`
            <h1>OAuth Configuration Error</h1>
            <p>${error.message}</p>
            <p>Please ensure ETSY_CLIENT_ID is set in your .env file</p>
            <a href="/">Return to Home</a>
        `);
    }
});

// OAuth callback endpoint
router.get('/redirect', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error('❌ OAuth callback error:', error);
        return res.send(`
            <h1>OAuth Authorization Failed</h1>
            <p>Error: ${error}</p>
            <a href="/">Return to Home</a>
        `);
    }

    if (!code) {
        return res.status(400).send(`
            <h1>OAuth Error</h1>
            <p>No authorization code received</p>
            <a href="/">Return to Home</a>
        `);
    }

    try {
        console.log('🔑 Exchanging authorization code for tokens...');
        const tokenData = await etsyOAuthService.exchangeCodeForToken(code, state);
        
        console.log('✅ Successfully authenticated with Etsy');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Connected to Etsy</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                    }
                    .success-box {
                        background: rgba(255, 255, 255, 0.1);
                        padding: 40px;
                        border-radius: 12px;
                        backdrop-filter: blur(10px);
                    }
                    h1 { margin: 0 0 20px 0; font-size: 2em; }
                    p { margin: 10px 0; opacity: 0.9; }
                </style>
            </head>
            <body>
                <div class="success-box">
                    <h1>✅ Successfully Connected!</h1>
                    <p>Your Etsy account has been securely connected.</p>
                    <p>This window will close automatically...</p>
                </div>
                <script>
                    // Notify parent window
                    if (window.opener) {
                        window.opener.postMessage('oauth-complete', window.location.origin);
                        setTimeout(() => window.close(), 1500);
                    } else {
                        // Fallback if not in popup
                        setTimeout(() => window.location.href = '/etsy.html', 2000);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('❌ Token exchange error:', error);
        res.status(500).send(`
            <h1>OAuth Token Exchange Failed</h1>
            <p>Error: ${error.message}</p>
            <a href="/">Return to Home</a>
        `);
    }
});

// Manually refresh token (for testing)
router.post('/refresh', async (req, res) => {
    try {
        const newToken = await etsyOAuthService.refreshAccessToken();
        res.json({ 
            success: true, 
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        console.error('❌ Token refresh error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Logout/disconnect
router.post('/disconnect', (req, res) => {
    try {
        etsyOAuthService.clearTokens();
        res.json({ success: true, message: 'Disconnected from Etsy' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
