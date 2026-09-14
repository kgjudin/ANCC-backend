export interface CalculatedPurchaseItem {
    product_id: string;
    quantity: number;
    unit: string;
    unit_rate: number;
    discount: number;
    tax: number;
    line_total: number;
    brand?: string;
    grade?: string;
    quality_status: string;
    quality_notes?: string;
}
export interface PurchaseCalculationInput {
    transport_cost?: number;
    other_charges?: number;
    tax_amount?: number;
    discount_amount?: number;
    paid_amount?: number;
    items: Array<{
        product_id: string;
        quantity: number;
        unit: string;
        unit_rate: number;
        discount?: number;
        tax?: number;
        brand?: string;
        grade?: string;
        quality_status?: string;
        quality_notes?: string;
    }>;
}
export interface CalculatedPurchaseResult {
    items: CalculatedPurchaseItem[];
    subtotal: number;
    transport_cost: number;
    other_charges: number;
    tax_amount: number;
    discount_amount: number;
    grand_total: number;
    paid_amount: number;
    outstanding_amount: number;
    payment_status: 'Unpaid' | 'Partially Paid' | 'Paid';
}
export declare function calculatePurchaseTotals(input: PurchaseCalculationInput): CalculatedPurchaseResult;
