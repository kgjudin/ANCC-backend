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

export function calculatePurchaseTotals(input: PurchaseCalculationInput): CalculatedPurchaseResult {
  let subtotal = 0;

  const items: CalculatedPurchaseItem[] = input.items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.unit_rate) || 0;
    const itemDiscount = Number(item.discount) || 0;
    const itemTax = Number(item.tax) || 0;

    if (qty <= 0) {
      throw new Error(`Quantity for product ${item.product_id} must be greater than zero.`);
    }
    if (rate < 0) {
      throw new Error(`Unit rate for product ${item.product_id} cannot be negative.`);
    }

    const line_total = Number(((qty * rate) - itemDiscount + itemTax).toFixed(2));
    subtotal += line_total;

    return {
      product_id: item.product_id,
      quantity: qty,
      unit: item.unit,
      unit_rate: rate,
      discount: itemDiscount,
      tax: itemTax,
      line_total,
      brand: item.brand,
      grade: item.grade,
      quality_status: item.quality_status || 'Approved',
      quality_notes: item.quality_notes
    };
  });

  subtotal = Number(subtotal.toFixed(2));
  const transport_cost = Number((input.transport_cost || 0).toFixed(2));
  const other_charges = Number((input.other_charges || 0).toFixed(2));
  const tax_amount = Number((input.tax_amount || 0).toFixed(2));
  const discount_amount = Number((input.discount_amount || 0).toFixed(2));

  const grand_total = Number(
    (subtotal + transport_cost + other_charges + tax_amount - discount_amount).toFixed(2)
  );

  if (grand_total < 0) {
    throw new Error('Grand total cannot be negative.');
  }

  const paid_amount = Number((input.paid_amount || 0).toFixed(2));

  if (paid_amount < 0) {
    throw new Error('Paid amount cannot be negative.');
  }

  if (paid_amount > grand_total) {
    throw new Error(`Paid amount (₹${paid_amount}) cannot exceed Grand Total (₹${grand_total}).`);
  }

  const outstanding_amount = Number((grand_total - paid_amount).toFixed(2));

  let payment_status: 'Unpaid' | 'Partially Paid' | 'Paid' = 'Unpaid';
  if (paid_amount >= grand_total) {
    payment_status = 'Paid';
  } else if (paid_amount > 0) {
    payment_status = 'Partially Paid';
  }

  return {
    items,
    subtotal,
    transport_cost,
    other_charges,
    tax_amount,
    discount_amount,
    grand_total,
    paid_amount,
    outstanding_amount,
    payment_status
  };
}
