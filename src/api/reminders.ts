import { apiRequest } from './apiClient';

export interface Reminder {
  id: string;
  customerId?: string;
  customerName?: string;
  amount?: number;
  dueDate: string;
  message: string;
  status: 'pending' | 'sent' | 'completed';
  createdAt: string;
}

export async function fetchReminders(): Promise<Reminder[]> {
  try {
    const res = await apiRequest<{ reminders: Reminder[] }>('/api/reminders');
    return res.reminders;
  } catch {
    const saved = localStorage.getItem('notibook_reminders');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function addReminderApi(reminder: Partial<Reminder>): Promise<Reminder> {
  try {
    const res = await apiRequest<{ reminder: Reminder }>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    });
    return res.reminder;
  } catch {
    const newReminder: Reminder = {
      id: `rem-${Date.now()}`,
      customerId: reminder.customerId,
      customerName: reminder.customerName || 'Customer',
      amount: reminder.amount,
      dueDate: reminder.dueDate || new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + 86400000)),
      message: reminder.message || 'Payment reminder for outstanding dues',
      status: 'pending',
      createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
    };
    const all = await fetchReminders();
    const updated = [newReminder, ...all];
    localStorage.setItem('notibook_reminders', JSON.stringify(updated));
    return newReminder;
  }
}

export async function deleteReminderApi(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/reminders/${id}`, { method: 'DELETE' });
    return true;
  } catch {
    const all = await fetchReminders();
    const updated = all.filter(r => r.id !== id);
    localStorage.setItem('notibook_reminders', JSON.stringify(updated));
    return true;
  }
}

export async function updateReminderApi(id: string, updates: Partial<Reminder>): Promise<Reminder | null> {
  try {
    const res = await apiRequest<{ reminder: Reminder }>(`/api/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.reminder;
  } catch {
    const all = await fetchReminders();
    const target = all.find(r => r.id === id);
    if (!target) return null;
    const updatedRem: Reminder = { ...target, ...updates };
    const updatedList = all.map(r => r.id === id ? updatedRem : r);
    localStorage.setItem('notibook_reminders', JSON.stringify(updatedList));
    return updatedRem;
  }
}

