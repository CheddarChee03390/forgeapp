// Input Validation Utilities
// Centralized validation for critical business entities

export const validators = {
  // Validate product/SKU data
  validateProduct: (product) => {
    const errors = [];
    
    if (!product.sku?.trim()) {
      errors.push('SKU is required');
    } else if (product.sku.trim().length > 64) {
      errors.push('SKU must be 64 characters or less');
    }
    
    if (!product.title?.trim()) {
      errors.push('Title is required');
    } else if (product.title.trim().length > 255) {
      errors.push('Title must be 255 characters or less');
    }
    
    if (product.weight !== undefined) {
      if (typeof product.weight !== 'number' || product.weight <= 0) {
        errors.push('Weight must be a positive number');
      }
    }
    
    if (product.material_id !== undefined) {
      if (!Number.isInteger(product.material_id) || product.material_id <= 0) {
        errors.push('Material ID must be a positive integer');
      }
    }
    
    if (product.type && product.type.trim().length > 50) {
      errors.push('Type must be 50 characters or less');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate pricing data
  validatePricing: (pricing) => {
    const errors = [];
    
    if (pricing.variation_sku !== undefined && !pricing.variation_sku?.trim()) {
      errors.push('Variation SKU is required');
    }
    
    if (pricing.weight !== undefined) {
      if (typeof pricing.weight !== 'number' || pricing.weight <= 0) {
        errors.push('Weight must be a positive number');
      }
    }
    
    if (pricing.costPerGram !== undefined) {
      if (typeof pricing.costPerGram !== 'number' || pricing.costPerGram < 0) {
        errors.push('Cost per gram must be a non-negative number');
      }
    }
    
    if (pricing.postage !== undefined) {
      if (typeof pricing.postage !== 'number' || pricing.postage < 0) {
        errors.push('Postage cost must be a non-negative number');
      }
    }
    
    if (pricing.calculated_price !== undefined) {
      if (typeof pricing.calculated_price !== 'number' || pricing.calculated_price <= 0) {
        errors.push('Calculated price must be a positive number');
      }
    }
    
    if (pricing.profit_margin_percent !== undefined) {
      const margin = pricing.profit_margin_percent;
      if (typeof margin !== 'number' || margin < 0 || margin > 100) {
        errors.push('Profit margin must be between 0 and 100');
      }
    }
    
    if (pricing.status !== undefined) {
      const validStatuses = ['pending', 'approved', 'rejected', 'pushed', 'failed'];
      if (!validStatuses.includes(pricing.status)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate material data
  validateMaterial: (material) => {
    const errors = [];
    
    if (!material.name?.trim()) {
      errors.push('Material name is required');
    } else if (material.name.trim().length > 100) {
      errors.push('Material name must be 100 characters or less');
    }
    
    if (material.costPerGram !== undefined) {
      if (typeof material.costPerGram !== 'number' || material.costPerGram <= 0) {
        errors.push('Cost per gram must be a positive number');
      }
    }
    
    if (material.color && material.color.trim().length > 50) {
      errors.push('Color must be 50 characters or less');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate Etsy listing data
  validateListing: (listing) => {
    const errors = [];
    
    if (listing.listing_id !== undefined) {
      if (!Number.isInteger(listing.listing_id) || listing.listing_id <= 0) {
        errors.push('Listing ID must be a positive integer');
      }
    }
    
    if (listing.title && listing.title.trim().length > 255) {
      errors.push('Title must be 255 characters or less');
    }
    
    if (listing.price !== undefined) {
      if (typeof listing.price !== 'number' || listing.price <= 0) {
        errors.push('Price must be a positive number');
      }
    }
    
    if (listing.quantity !== undefined) {
      if (!Number.isInteger(listing.quantity) || listing.quantity < 0) {
        errors.push('Quantity must be a non-negative integer');
      }
    }
    
    if (listing.state && !['active', 'inactive', 'draft'].includes(listing.state)) {
      errors.push('State must be active, inactive, or draft');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Validate batch operations
  validateBatchOperation: (operation) => {
    const errors = [];
    
    if (!operation.skus || !Array.isArray(operation.skus)) {
      errors.push('SKUs must be an array');
    } else if (operation.skus.length === 0) {
      errors.push('At least one SKU is required');
    } else if (operation.skus.length > 1000) {
      errors.push('Batch operations limited to 1000 items');
    }
    
    if (operation.action && !['push', 'calculate', 'reject', 'approve'].includes(operation.action)) {
      errors.push('Action must be push, calculate, reject, or approve');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Export individual validators for convenience
export const {
  validateProduct,
  validatePricing,
  validateMaterial,
  validateListing,
  validateBatchOperation
} = validators;
