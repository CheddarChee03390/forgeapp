// Material Model - Business logic for materials
export class Material {
    constructor({ materialId, name, costPerGram, sellPricePerGram }) {
        this.materialId = materialId;
        this.name = name;
        this.costPerGram = parseFloat(costPerGram) || 0;
        this.sellPricePerGram = parseFloat(sellPricePerGram) || 0;
    }

    validate() {
        const errors = [];
        
        if (!this.materialId || typeof this.materialId !== 'string' || this.materialId.trim() === '') {
            errors.push('MaterialID is required');
        }
        
        if (!this.name || typeof this.name !== 'string' || this.name.trim() === '') {
            errors.push('Name is required');
        }
        
        if (isNaN(this.costPerGram) || this.costPerGram < 0) {
            errors.push('Cost per gram must be a non-negative number');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            materialId: this.materialId,
            name: this.name,
            costPerGram: this.costPerGram,
            sellPricePerGram: this.sellPricePerGram
        };
    }
}
