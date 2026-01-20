# 🔐 Etsy OAuth Setup Guide

## Overview
The Forge App uses secure OAuth 2.0 authentication with PKCE to connect to your Etsy store. This ensures your credentials are never visible in the browser and tokens are encrypted in the database.

## Prerequisites
- An Etsy seller account
- An Etsy developer app (free to create)

## Setup Steps

### 1. Create Etsy Developer App
1. Go to https://www.etsy.com/developers/your-apps
2. Click "Create a New App"
3. Fill in the app details:
   - **App Name**: Forge Inventory Manager (or any name)
   - **Tell us about your app**: Personal inventory management
   - **Website URL**: http://localhost:3004
4. Click "Read Terms and Create App"

### 2. Configure OAuth Redirect URI
1. In your app settings, scroll to "Redirect URIs"
2. Add: `http://localhost:3004/oauth/etsy/callback`
3. Click "Add URI" and then "Update"

### 3. Get Your Credentials
From your Etsy app dashboard, copy:
- **Keystring** (this is your Client ID)
- **Shared Secret** (click "Show" to reveal)

⚠️ **IMPORTANT**: Keep the Shared Secret private!

### 4. Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Generate an encryption key:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Edit `.env` and fill in your values:
   ```env
   ETSY_CLIENT_ID=your_keystring_from_etsy
   ETSY_CLIENT_SECRET=your_shared_secret_from_etsy
   ETSY_REDIRECT_URI=http://localhost:3004/oauth/etsy/callback
   PORT=3004
   ENCRYPTION_KEY=paste_generated_key_here
   ```

### 5. Start the Server
```powershell
npm start
```

### 6. Connect to Etsy
1. Navigate to http://localhost:3004/etsy.html
2. Click "🔗 Connect to Etsy"
3. Log in to your Etsy account (if not already logged in)
4. Click "Allow Access" to authorize the app
5. You'll be redirected back to the app with a success message
6. Click "🔄 Sync from Etsy" to fetch your inventory

## How It Works

### OAuth Flow
1. User clicks "Connect to Etsy"
2. App generates a PKCE challenge and redirects to Etsy
3. User authorizes the app on Etsy's website
4. Etsy redirects back with an authorization code
5. App exchanges the code for access and refresh tokens
6. Tokens are encrypted and stored in the database
7. App fetches shop ID automatically

### Token Security
- Tokens are encrypted using AES-256 (via crypto-js)
- Stored in SQLite database (not in browser)
- Auto-refresh when expired
- Never displayed in UI

### API Permissions
The app requests these scopes:
- `listings_r` - Read your Etsy listings
- `shops_r` - Read your shop information

## Troubleshooting

### "OAuth Configuration Error"
- Ensure `.env` file exists and has valid `ETSY_CLIENT_ID`
- Restart the server after creating `.env`

### "OAuth Token Exchange Failed"
- Verify `ETSY_CLIENT_SECRET` is correct
- Ensure redirect URI matches exactly: `http://localhost:3004/oauth/etsy/callback`
- Check that the URI is added in your Etsy app settings

### "Not authenticated" during sync
- Click "Connect to Etsy" to reauthorize
- Tokens may have expired (refresh tokens last 90 days)

### Can't find Keystring/Shared Secret
1. Go to https://www.etsy.com/developers/your-apps
2. Click on your app name
3. Keystring and Shared Secret are at the top of the app page

## Security Best Practices

✅ **DO:**
- Keep `.env` file private (never commit to git)
- Use strong ENCRYPTION_KEY
- Regenerate ENCRYPTION_KEY if exposed

❌ **DON'T:**
- Share your Shared Secret
- Commit `.env` to version control
- Display tokens in browser console

## File Structure
```
forge-app/
├── .env                    # Your credentials (create from .env.example)
├── .env.example           # Template with instructions
├── services/
│   └── etsyOAuthService.js  # OAuth token management
├── routes/
│   └── oauth.js             # OAuth endpoints
└── public/
    ├── etsy.html            # UI with Connect button
    └── etsy.js              # OAuth flow logic
```

## Database
OAuth tokens are stored in the `OAuth_Tokens` table:
- Singleton design (only one row with id=1)
- Contains: access_token, refresh_token, expires_at, shop_id
- Tokens are base64 encoded (upgrade to AES encryption for production)

## Need Help?
- Etsy API Documentation: https://www.etsy.com/developers/documentation
- OAuth 2.0 with PKCE: https://oauth.net/2/pkce/
