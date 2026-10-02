import { Customer } from '../types';
import { apiRequest } from './apiClient';
import { cleanPartyOrCustomerName } from '../voice/LanguageUtils';
import { resolveCustomerAgainstDatabase } from '../voice/CustomerResolver';

export async function fetchCustomers(): Promise<Customer[]> {
  try {
    const res = await apiRequest<{ customers: Customer[] }>('/api/customers');
    if (res?.customers && Array.isArray(res.customers)) {
      localStorage.setItem('notibook_customers', JSON.stringify(res.customers));
      return res.customers;
    }
  } catch {}
  const saved = localStorage.getItem('notibook_customers');
  return saved ? JSON.parse(saved) : [];
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
  if (!idOrName) return null;
  const all = await fetchCustomers();
  const res = resolveCustomerAgainstDatabase(idOrName, all);
  if (res.status === 'EXACT' || res.status === 'NORMALIZED' || res.status === 'PHONE') {
    return res.customer || null;
  }
  return null;
}

export async function createCustomerApi(customer: Partial<Customer>): Promise<Customer> {
  const sanitizedName = cleanPartyOrCustomerName(customer.name || '') || customer.name || 'New Customer';
  const payload = {
    ...customer,
    name: sanitizedName,
  };

  try {
    const res = await apiRequest<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.customer) {
      const all = await fetchCustomers();
      const updated = [res.customer, ...all.filter(c => c.id !== res.customer.id && c.name.toLowerCase() !== res.customer.name.toLowerCase())];
      localStorage.setItem('notibook_customers', JSON.stringify(updated));
      return res.customer;
    }
  } catch {}

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    name: sanitizedName,
    phone: customer.phone || '+91 98000 00000',
    address: customer.address || '',
    balance: customer.balance || 0,
    lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
    status: (customer.balance || 0) > 0 ? 'due' : (customer.balance || 0) < 0 ? 'advance' : 'settled',
    createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
  };
  const all = await fetchCustomers();
  const updated = [newCustomer, ...all.filter(c => c.name.toLowerCase() !== sanitizedName.toLowerCase())];
  localStorage.setItem('notibook_customers', JSON.stringify(updated));
  return newCustomer;
}

export async function deleteCustomerApi(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/customers/${id}`, { method: 'DELETE' });
  } catch {}
  const all = await fetchCustomers();
  const updated = all.filter(c => c.id !== id);
  localStorage.setItem('notibook_customers', JSON.stringify(updated));
  return true;
}

export async function updateCustomerApi(id: string, updates: Partial<Customer>): Promise<Customer | null> {
  if (updates.name) {
    updates.name = cleanPartyOrCustomerName(updates.name);
  }
  try {
    const res = await apiRequest<{ customer: Customer }>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res?.customer) {
      const all = await fetchCustomers();
      const updatedList = all.map(c => c.id === id ? res.customer : c);
      localStorage.setItem('notibook_customers', JSON.stringify(updatedList));
      return res.customer;
    }
  } catch {}

  const all = await fetchCustomers();
  const target = all.find(c => c.id === id);
  if (!target) return null;
  const updatedCustomer: Customer = { ...target, ...updates };
  const updatedList = all.map(c => c.id === id ? updatedCustomer : c);
  localStorage.setItem('notibook_customers', JSON.stringify(updatedList));
  return updatedCustomer;
}

