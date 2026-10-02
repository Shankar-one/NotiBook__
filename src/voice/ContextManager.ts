import { ConversationContext } from './types';
import { Customer, Transaction } from '../types';
import { resolveCustomerAgainstDatabase } from './CustomerResolver';

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
   * Resolves contextual customer references using CustomerResolver and active context
   */
  public resolveCustomer(input: string, knownCustomers: Customer[]): {
    customer?: Customer;
    isAmbiguous?: boolean;
    candidates?: Customer[];
  } {
    const text = input.toLowerCase();

    // 1. Check for pronouns referring to active customer
    const pronounRegex = /\b(usmein|usme|uski|uska|uske|usse|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|iski|isse|woh|same\s+customer|same\s+one|that\s+customer|him|her|them)\b|उसमें|उसका|उसकी|उसके|उससे|उनका|उनकी|उनके|उनसे|इसमें|इसका|इसकी|इससे/i;
    if (pronounRegex.test(text) && this.context.activeCustomer) {
      const active = knownCustomers.find((c) => c.id === this.context.activeCustomer?.id);
      if (active) {
        return { customer: active };
      }
    }

    // 2. High-precision resolution against customer database
    const resolution = resolveCustomerAgainstDatabase(input, knownCustomers);
    if (resolution.status === 'EXACT' || resolution.status === 'NORMALIZED' || resolution.status === 'PHONE') {
      return { customer: resolution.customer };
    }
    if (resolution.status === 'AMBIGUOUS') {
      return { isAmbiguous: true, candidates: resolution.candidates };
    }

    // Fall back to active customer if query has action without explicit customer name
    if (this.context.activeCustomer && (text.includes('balance') || text.includes('add') || text.includes('de do') || text.includes('batao') || text.includes('last') || text.includes('उधर') || text.includes('उधार') || text.includes('लिख'))) {
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
