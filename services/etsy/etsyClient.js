// Etsy Client - Authentication and HTTP layer ONLY
// This is the ONLY file that calls fetch() and builds auth headers
import etsyOAuthService from '../etsyOAuthService.js';

class EtsyClient {
    constructor() {
        this.baseUrl = 'https://openapi.etsy.com/v3';
        this.clientId = process.env.ETSY_CLIENT_ID || '';
        this.clientSecret = process.env.ETSY_CLIENT_SECRET || '';
    }

    /**
     * Core fetch function with Etsy auth headers
     * This is the ONLY place that should build Authorization headers
     */
    async etsyFetch(url, options = {}) {
        const accessToken = await etsyOAuthService.getValidAccessToken();
        
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        return response;
    }

    /**
     * Fetch with optional x-api-key header (for endpoints that require it)
     */
    async etsyFetchWithApiKey(url, options = {}) {
        const accessToken = await etsyOAuthService.getValidAccessToken();
        const apiKeyHeader = (this.clientId && this.clientSecret)
            ? `${this.clientId}:${this.clientSecret}`
            : this.clientId;
        
        const headers = {
            ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        return response;
    }

    /**
     * Get shop ID from OAuth service
     */
    getShopId() {
        return etsyOAuthService.getShopId();
    }

    /**
     * Build full Etsy API URL
     */
    buildUrl(path) {
        return `${this.baseUrl}${path}`;
    }
}

export default new EtsyClient();
