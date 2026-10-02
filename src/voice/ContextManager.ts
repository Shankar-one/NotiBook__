import { ConversationContext } from './types';
import { Customer, Transaction } from '../types';
import { resolveCustomerAgainstDatabase } from './CustomerResolver';

export class ContextManager {
  private context: ConversationContext = {
    recentTurns: [],
    recentCustomersMentioned: [],
  };

  public getContext(): ConversationContext {
    return { ...this.context };
  }

  public setActiveCustomer(customer: { id: string; name: string; phone?: string; balance?: number; address?: string; notes?: string } | null): void {
    if (!customer) {
      delete this.context.activeCustomer;
      delete this.context.active_customer;
      delete this.context.active_customer_id;
    } else {
      const structuredCust = {
        id: customer.id,
        name: customer.name,
        balance: customer.balance ?? 0,
      };
      this.context.activeCustomer = structuredCust;
      this.context.active_customer = structuredCust;
      this.context.active_customer_id = customer.id;
      // Maintain recent unique customer IDs (up to 3)
      const existing = (this.context.recentCustomersMentioned || []).filter(c => c.id !== customer.id);
      this.context.recentCustomersMentioned = [{ id: customer.id, name: customer.name }, ...existing].slice(0, 3);
      console.log(`[Context] Active customer set to: ${customer.name} (ID: ${customer.id}, Balance: ₹${customer.balance ?? 0})`);
    }
  }

  public clearActiveCustomer(): void {
    this.setActiveCustomer(null);
  }

  public getActiveCustomer() {
    return this.context.activeCustomer || this.context.active_customer;
  }

  public setRecentCustomersMentioned(customers: { id: string; name: string }[]): void {
    this.context.recentCustomersMentioned = customers;
    if (customers.length === 1) {
      this.context.active_customer_id = customers[0].id;
    }
  }

  public getRecentCustomersMentioned(): { id: string; name: string }[] {
    return this.context.recentCustomersMentioned || [];
  }

  public recordAction(action: string, entity?: { type: 'CUSTOMER' | 'TRANSACTION' | 'REMINDER'; id: string; name?: string; amount?: number }): void {
    this.context.last_action = action;
    this.context.lastIntent = action;
    if (entity) {
      this.context.last_created_entity = entity;
    }
  }

  public recordTransaction(tx: { id: string; amount: number; type: 'credit' | 'debit'; customerId?: string; partyName?: string; date: string }): void {
    this.context.last_transaction = tx;
    this.context.activeTransaction = {
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      description: `${tx.type === 'credit' ? 'Payment from' : 'Credit given to'} ${tx.partyName || 'Customer'}`,
    };
    if (tx.type === 'credit') {
      this.context.last_payment = tx;
    }
  }

  public setActiveTransaction(tx: { id: string; amount?: number; description?: string; type?: 'credit' | 'debit' } | null): void {
    if (!tx) {
      delete this.context.activeTransaction;
      delete this.context.last_transaction;
    } else {
      this.context.activeTransaction = tx;
      this.context.last_transaction = {
        id: tx.id,
        amount: tx.amount || 0,
        type: tx.type || 'credit',
        date: new Date().toISOString(),
      };
      console.log(`[Context] Active transaction set to: ₹${tx.amount} (${tx.description || tx.id})`);
    }
  }

  public getActiveTransaction() {
    return this.context.activeTransaction || this.context.last_transaction;
  }

  public getLastPayment() {
    return this.context.last_payment;
  }

  public setPendingConfirmation(confirmation: ConversationContext['pendingConfirmation']): void {
    this.context.pendingConfirmation = confirmation;
  }

  public getPendingConfirmation() {
    return this.context.pendingConfirmation;
  }

  public clearPendingConfirmation(): void {
    delete this.context.pendingConfirmation;
  }

  public setPendingSlotFilling(slotFilling: ConversationContext['pendingSlotFilling']): void {
    this.context.pendingSlotFilling = slotFilling;
    if (slotFilling) {
      this.context.pending_action = slotFilling.action;
      this.context.pending_field = slotFilling.missingFields[0] || null;
    } else {
      this.context.pending_action = null;
      this.context.pending_field = null;
    }
  }

  public getPendingSlotFilling() {
    return this.context.pendingSlotFilling;
  }

  public clearPendingSlotFilling(): void {
    delete this.context.pendingSlotFilling;
    this.context.pending_action = null;
    this.context.pending_field = null;
  }

  public addTurn(role: 'user' | 'assistant' | 'system', text: string): void {
    this.context.recentTurns.push({
      role,
      text,
      timestamp: Date.now(),
    });
    // Keep last 16 turns for conversational coherence
    if (this.context.recentTurns.length > 16) {
      this.context.recentTurns = this.context.recentTurns.slice(-16);
    }
  }

  public getRecentTurns(): ConversationContext['recentTurns'] {
    return [...this.context.recentTurns];
  }

  public setLastIntent(intent: string, entities?: any): void {
    this.context.lastIntent = intent;
    this.context.last_action = intent;
    if (entities) {
      this.context.lastEntities = entities;
    }
  }

  /**
   * Resolves contextual customer references using CustomerResolver and active context
   */
  public resolveCustomer(input: string, knownCustomers: Customer[]): {
    customer?: Customer;
    isAmbiguous?: boolean;
    candidates?: Customer[];
  } {
    const text = input.toLowerCase();

    // 1. Check for pronouns or contextual account references ("usne", "uska", "usme", "into account", "in account", "khate mein")
    const contextualRegex = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|iski|isse|woh|same\s+customer|same\s+one|that\s+customer|into\s+(?:the\s+)?account|to\s+(?:the\s+)?account|in\s+(?:the\s+)?account|khate\s+mein|account\s+mein|him|her|them)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उससे|उनका|उनकी|उनके|उनसे|इसमें|इसका|इसकी|इससे|उन्हें|उनको|खाते\s*में|अकाउंट\s*में/i;
    const isContextualMatch = contextualRegex.test(text);

    // 2. High-precision explicit resolution against customer database
    const resolution = resolveCustomerAgainstDatabase(input, knownCustomers);
    if (resolution.status === 'EXACT' || resolution.status === 'NORMALIZED' || resolution.status === 'PHONE') {
      if (resolution.customer) {
        this.setActiveCustomer(resolution.customer);
      }
      return { customer: resolution.customer };
    }
    if (resolution.status === 'AMBIGUOUS') {
      return { isAmbiguous: true, candidates: resolution.candidates };
    }

    // 3. Ambiguity check on recently mentioned customers (e.g. Ramesh then Rahul)
    const recent = this.context.recentCustomersMentioned || [];
    if (recent.length > 1 && (isContextualMatch || text.includes('add') || text.includes('balance') || text.includes('khata'))) {
      const candidateCustomers = recent
        .map(r => knownCustomers.find(c => c.id === r.id || c.name.toLowerCase() === r.name.toLowerCase()))
        .filter(Boolean) as Customer[];
      if (candidateCustomers.length > 1) {
        return { isAmbiguous: true, candidates: candidateCustomers };
      }
    }

    // 4. Single unambiguous active customer in context
    if ((isContextualMatch || text.includes('balance') || text.includes('add') || text.includes('de do') || text.includes('batao') || text.includes('last') || text.includes('उधर') || text.includes('उधार') || text.includes('लिख') || text.includes('ab kitna') || text.includes('kitna baaki')) &&
        (this.context.activeCustomer || this.context.active_customer)) {
      const activeId = this.context.active_customer_id || this.context.activeCustomer?.id;
      const active = knownCustomers.find((c) => c.id === activeId);
      if (active) {
        return { customer: active };
      }
    }

    return {};
  }

  public updateContext(partial: Partial<ConversationContext>): void {
    this.context = {
      ...this.context,
      ...partial,
      activeCustomer: partial.active_customer || partial.activeCustomer || this.context.activeCustomer,
      active_customer: partial.active_customer || partial.activeCustomer || this.context.active_customer,
      active_customer_id: partial.active_customer_id || (partial.active_customer ? partial.active_customer.id : this.context.active_customer_id),
    };
  }

  public reset(): void {
    this.context = {
      recentTurns: [],
      recentCustomersMentioned: [],
    };
  }
}
