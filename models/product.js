// Product Model - Business logic for master stock items
export class Product {
    constructor(data) {
        this.sku = data.sku;
        this.type = data.type || '';
        this.length = parseFloat(data.length) || 0;
        this.weight = parseFloat(data.weight) || 0;
        this.material = data.material || '';
        this.postageCost = parseFloat(data.postageCost) || parseFloat(data.postagecost) || 0;
    }

    validate() {
        const errors = [];
        
        if (!this.sku || typeof this.sku !== 'string' || this.sku.trim() === '') {
            errors.push('SKU is required');
        }
        
        if (isNaN(this.weight) || this.weight < 0) {
            errors.push('Weight must be a non-negative number');
        }
        
        if (isNaN(this.postageCost) || this.postageCost < 0) {
            errors.push('Postage cost must be a non-negative number');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            sku: this.sku,
            type: this.type,
            length: this.length,
            weight: this.weight,
            material: this.material,
            postageCost: this.postageCost
        };
    }
}
