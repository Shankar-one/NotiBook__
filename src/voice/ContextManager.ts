import { ConversationContext } from './types';
import { Customer, Transaction } from '../types';

export class ContextManager {
  private context: ConversationContext = {
    recentTurns: [],
  };

  public getContext(): ConversationContext {
    return { ...this.context };
  }

  public setActiveCustomer(customer: { id: string; name: string; phone?: string; balance?: number } | null): void {
    if (!customer) {
      delete this.context.activeCustomer;
    } else {
      this.context.activeCustomer = customer;
      console.log(`[Context] Active customer set to: ${customer.name} (Balance: ₹${customer.balance ?? 0})`);
    }
  }

  public getActiveCustomer() {
    return this.context.activeCustomer;
  }

  public setActiveTransaction(tx: { id: string; amount?: number; description?: string; type?: 'credit' | 'debit' } | null): void {
    if (!tx) {
      delete this.context.activeTransaction;
    } else {
      this.context.activeTransaction = tx;
      console.log(`[Context] Active transaction set to: ₹${tx.amount} (${tx.description || tx.id})`);
    }
  }

  public getActiveTransaction() {
    return this.context.activeTransaction;
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
  }

  public getPendingSlotFilling() {
    return this.context.pendingSlotFilling;
  }

  public clearPendingSlotFilling(): void {
    delete this.context.pendingSlotFilling;
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
    if (entities) {
      this.context.lastEntities = entities;
    }
  }

  /**
   * Resolves contextual customer references like "usmein", "uski", "woh", "same customer"
   */
  public resolveCustomer(input: string, knownCustomers: Customer[]): {
    customer?: Customer;
    isAmbiguous?: boolean;
    candidates?: Customer[];
  } {
    const text = input.toLowerCase();

    // 1. Check for pronouns referring to active customer
    const pronounRegex = /\b(usmein|usme|uski|uska|unka|unhe|unko|isme|ismein|iska|iski|woh|same\s+customer|same\s+one|that\s+customer|him|her|them)\b/i;
    if (pronounRegex.test(text) && this.context.activeCustomer) {
      const active = knownCustomers.find((c) => c.id === this.context.activeCustomer?.id);
      if (active) {
        return { customer: active };
      }
    }

    // 2. Direct name matching
    // Extract candidate names from query
    for (const cust of knownCustomers) {
      const nameParts = cust.name.toLowerCase().split(/\s+/);
      const firstName = nameParts[0];
      const fullName = cust.name.toLowerCase();

      if (text.includes(fullName)) {
        return { customer: cust };
      }
    }

    // First name matching with ambiguity check
    const matches: Customer[] = [];
    for (const cust of knownCustomers) {
      const firstName = cust.name.toLowerCase().split(/\s+/)[0];
      if (firstName.length > 2 && text.includes(firstName)) {
        matches.push(cust);
      }
    }

    if (matches.length === 1) {
      return { customer: matches[0] };
    } else if (matches.length > 1) {
      return {
        isAmbiguous: true,
        candidates: matches,
      };
    }

    // Fall back to active customer if query has action without explicit name
    if (this.context.activeCustomer && (text.includes('balance') || text.includes('add') || text.includes('de do') || text.includes('batao') || text.includes('last'))) {
      const active = knownCustomers.find((c) => c.id === this.context.activeCustomer?.id);
      if (active) return { customer: active };
    }

    return {};
  }

  public reset(): void {
    this.context = {
      recentTurns: [],
    };
  }
}
