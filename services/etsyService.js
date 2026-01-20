// Etsy Service - Facade maintaining backward compatibility
// Delegates to specialized services while preserving existing API

import listingsService from './etsy/listings.service.js';
import mappingsService from './etsy/mappings.service.js';
import ordersService from './etsy/orders.service.js';

class EtsyService {
    // Delegate all methods to appropriate services
    
    // ===== LISTINGS SERVICE =====
    getAllListings() {
        return listingsService.getAllListings();
    }

    getListingById(listingId) {
        return listingsService.getListingById(listingId);
    }

    searchListings(searchTerm) {
        return listingsService.searchListings(searchTerm);
    }

    async fetchFromEtsy(limit = 100, offset = 0) {
        return listingsService.fetchFromEtsy(limit, offset);
    }

    async syncListings() {
        return listingsService.syncListings();
    }

    async saveListings(listings) {
        return listingsService.saveListings(listings);
    }

    async fetchVariations(listingId) {
        return listingsService.fetchVariations(listingId);
    }

    async pushPrefixedSkus(listingId, prefix = 'ETSY_') {
        return listingsService.pushPrefixedSkus(listingId, prefix);
    }

    saveVariationsFromSkus(listing) {
        return listingsService.saveVariationsFromSkus(listing);
    }

    async saveVariationsFromInventory(listingId, inventory) {
        return listingsService.saveVariationsFromInventory(listingId, inventory);
    }

    async saveVariations(listing) {
        return listingsService.saveVariations(listing);
    }

    getVariationsForListing(listingId) {
        return listingsService.getVariationsForListing(listingId);
    }

    getSyncStats() {
        return listingsService.getSyncStats();
    }

    deleteListingCache(listingId) {
        return listingsService.deleteListingCache(listingId);
    }

    clearCache() {
        return listingsService.clearCache();
    }

    async updateVariationPrice(listingId, variationSku, newPrice) {
        return listingsService.updateVariationPrice(listingId, variationSku, newPrice);
    }

    async updatePrices(priceUpdates) {
        return listingsService.updatePrices(priceUpdates);
    }

    getMissingSkuData() {
        return listingsService.getMissingSkuData();
    }

    getListingsWithoutSku() {
        return listingsService.getListingsWithoutSku();
    }

    getSkippedPricingItems() {
        return listingsService.getSkippedPricingItems();
    }

    // ===== MAPPINGS SERVICE =====
    saveVariationMapping(variationSku, internalSku) {
        return mappingsService.saveVariationMapping(variationSku, internalSku);
    }

    getAllMappings() {
        return mappingsService.getAllMappings();
    }

    deleteMapping(variationSku) {
        return mappingsService.deleteMapping(variationSku);
    }

    simulateMappingImport(rows, mode = 'both') {
        return mappingsService.simulateMappingImport(rows, mode);
    }

    importMappings(rows, mode = 'both') {
        return mappingsService.importMappings(rows, mode);
    }

    getUnmappedVariations() {
        return mappingsService.getUnmappedVariations();
    }

    // ===== LEGACY/UNUSED =====
    // Kept for backward compatibility but no longer used
    setCredentials(apiKey, shopId) {
        // No-op - OAuth is used instead
    }
}

export default new EtsyService();
