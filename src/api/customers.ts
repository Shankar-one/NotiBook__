import { Customer } from '../types';
import { apiRequest } from './apiClient';

export async function fetchCustomers(): Promise<Customer[]> {
  try {
    const res = await apiRequest<{ customers: Customer[] }>('/api/customers');
    return res.customers;
  } catch {
    const saved = localStorage.getItem('notibook_customers');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function searchCustomersApi(query: string): Promise<Customer[]> {
  try {
    const res = await apiRequest<{ customers: Customer[] }>(`/api/customers/search?q=${encodeURIComponent(query)}`);
    return res.customers;
  } catch {
    const all = await fetchCustomers();
    const q = query.toLowerCase();
    return all.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }
}

export async function getCustomerByIdOrName(idOrName: string): Promise<Customer | null> {
  const all = await fetchCustomers();
  const lower = idOrName.toLowerCase().trim();
  const found = all.find(c => c.id === idOrName || c.name.toLowerCase() === lower);
  if (found) return found;
  // Partial match
  return all.find(c => c.name.toLowerCase().includes(lower)) || null;
}

export async function createCustomerApi(customer: Partial<Customer>): Promise<Customer> {
  try {
    const res = await apiRequest<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
    return res.customer;
  } catch {
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: customer.name || 'New Customer',
      phone: customer.phone || '+91 98000 00000',
      address: customer.address || '',
      balance: customer.balance || 0,
      lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
      status: (customer.balance || 0) > 0 ? 'due' : 'settled',
      createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
    };
    const all = await fetchCustomers();
    const updated = [newCustomer, ...all];
    localStorage.setItem('notibook_customers', JSON.stringify(updated));
    return newCustomer;
  }
}

export async function deleteCustomerApi(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/customers/${id}`, { method: 'DELETE' });
    return true;
  } catch {
    const all = await fetchCustomers();
    const updated = all.filter(c => c.id !== id);
    localStorage.setItem('notibook_customers', JSON.stringify(updated));
    return true;
  }
}

export async function updateCustomerApi(id: string, updates: Partial<Customer>): Promise<Customer | null> {
  try {
    const res = await apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.customer;
  } catch {
    const all = await fetchCustomers();
    const target = all.find(c => c.id === id);
    if (!target) return null;
    const updatedCustomer: Customer = { ...target, ...updates };
    const updatedList = all.map(c => c.id === id ? updatedCustomer : c);
    localStorage.setItem('notibook_customers', JSON.stringify(updatedList));
    return updatedCustomer;
  }
}

