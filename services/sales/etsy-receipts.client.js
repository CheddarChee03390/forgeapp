/**
 * Etsy Receipts API Client
 * Handles fetching receipts/orders from Etsy API
 * Uses etsyClient for all HTTP calls
 */

import etsyClient from '../etsy/etsyClient.js';

class EtsyReceiptsClient {
    /**
     * Fetch receipts from Etsy
     * Returns raw receipt data for processing
     * Etsy API: GET /v3/application/shops/{shop_id}/receipts
     */
    async fetchReceipts(startDate, endDate) {
        try {
            const limit = 100;
            let offset = 0;
            let hasMore = true;
            const allReceipts = [];

            const shopId = etsyClient.getShopId();
            if (!shopId) {
                throw new Error('Not authenticated. Please connect to Etsy first.');
            }

            while (hasMore) {
                const params = new URLSearchParams({
                    limit: String(limit),
                    offset: String(offset),
                    was_paid: 'true',
                    includes: 'Transactions'
                });

                // Convert dates to Unix timestamps if provided (Etsy API requirement)
                if (startDate) {
                    const minCreated = Math.floor(new Date(startDate).getTime() / 1000);
                    params.append('min_created', String(minCreated));
                }
                if (endDate) {
                    const maxCreated = Math.floor(new Date(endDate).getTime() / 1000) + 86399; // End of day
                    params.append('max_created', String(maxCreated));
                }

                // Build full URL - Etsy Receipts API requires /application/ prefix
                const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts?${params.toString()}`);
                const response = await etsyClient.etsyFetchWithApiKey(url);

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(
                        error.error || `Etsy API error: ${response.status} ${response.statusText}`
                    );
                }

                const data = await response.json();
                const receipts = data.results || [];

                allReceipts.push(...receipts);

                hasMore = receipts.length === limit;
                offset += limit;
            }

            return allReceipts;
        } catch (error) {
            console.error('❌ Error fetching receipts:', error);
            throw error;
        }
    }
}

export default new EtsyReceiptsClient();
