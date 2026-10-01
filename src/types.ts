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
  paymentMode: 'Cash' | 'UPI' | 'Credit' | 'Bank Transfer';
  paymentStatus: 'Paid' | 'Draft' | 'Due';
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'in' | 'out'; // in = Money In, out = Money Out
  category: 'Sale' | 'Customer Payment' | 'Expense' | 'Supplier Payment' | 'Salary' | 'Other';
  description: string;
  partyName?: string;
  paymentMode: 'Cash' | 'UPI' | 'Bank' | 'Credit';
  amount: number;
  referenceId?: string;
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
