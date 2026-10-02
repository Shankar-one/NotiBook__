export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  balance: number; // positive = customer owes us (Due / You will receive), negative = we owe them (Advance / You give)
  lastTransactionDate: string;
  status: 'due' | 'settled' | 'advance';
  notes?: string;
  createdAt: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'gave' | 'got'; // 'gave' = Maine Diye (credit given to customer), 'got' = Maine Liye (payment received)
  amount: number;
  date: string;
  note: string;
  billId?: string;
}

export interface BillItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  productId?: string;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Bank' | 'Cheque' | 'Credit' | 'Other';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentMode: PaymentMethod;
  paymentStatus: 'Paid' | 'Draft' | 'Due' | 'Partial' | 'Cancelled';
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'in' | 'out'; // in = Money In / Income, out = Money Out / Outgoing
  category: 'Sale' | 'Customer Payment' | 'Customer Credit' | 'Expense' | 'Supplier Payment' | 'Salary' | 'Purchase' | 'Refund' | 'Other';
  description: string;
  partyName?: string;
  paymentMode: PaymentMethod;
  amount: number;
  referenceId?: string;
  customerId?: string;
  invoiceId?: string;
  direction?: 'INCOME' | 'OUTGOING';
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  changeQty: number; // e.g. -2 for sale, +20 for purchase
  reason: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN';
  referenceId?: string; // invoiceId or description
  date: string;
  finalQty: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stockQty: number;
  lowStockThreshold: number;
  buyPrice: number;
  sellPrice: number;
  unit: string;
  sku?: string;
}

export interface ShopSettings {
  shopName: string;
  merchantName: string;
  category: string;
  phone: string;
  address: string;
  gstNumber: string;
  currencySymbol: string;
  defaultTaxRate: number;
}
