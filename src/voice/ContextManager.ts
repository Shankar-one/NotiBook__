import { ConversationContext, PendingConfirmation, PendingSlotFilling } from './types';
import { Customer } from '../types';
import { resolveCustomerAgainstDatabase } from './CustomerResolver';

export class ContextManager {
  private context: ConversationContext = {
    recentTurns: [],
    currentPage: 'home',
    detectedLanguage: 'hinglish',
  };

  public getContext(): ConversationContext {
    return { ...this.context };
  }

  public setActiveCustomer(customer: { id: string; name: string; phone?: string; balance?: number } | null): void {
    if (!customer) {
      delete this.context.activeCustomer;
    } else {
      this.context.activeCustomer = customer;
      this.context.lastEntity = {
        type: 'customer',
        id: customer.id,
        name: customer.name,
      };
      console.log(`[Context] Active customer set to: ${customer.name} (ID: ${customer.id}, Balance: ₹${customer.balance ?? 0})`);
    }
  }

  public getActiveCustomer() {
    return this.context.activeCustomer;
  }

  public setLastEntity(entity: { type: 'customer' | 'transaction' | 'invoice' | 'product'; id: string; name: string } | null): void {
    if (!entity) {
      delete this.context.lastEntity;
    } else {
      this.context.lastEntity = entity;
    }
  }

  public getLastEntity() {
    return this.context.lastEntity;
  }

  public setLastAction(action: string, toolResult?: any): void {
    this.context.lastAction = action;
    if (toolResult !== undefined) {
      this.context.lastToolResult = toolResult;
    }
  }

  public getLastAction() {
    return this.context.lastAction;
  }

  public setCurrentPage(page: string): void {
    this.context.currentPage = page;
  }

  public getCurrentPage(): string {
    return this.context.currentPage || 'home';
  }

  public setDetectedLanguage(lang: 'hindi' | 'hinglish' | 'english'): void {
    this.context.detectedLanguage = lang;
  }

  public getDetectedLanguage(): 'hindi' | 'hinglish' | 'english' {
    return this.context.detectedLanguage || 'hinglish';
  }

  public setActiveTransaction(tx: { id: string; amount?: number; description?: string; type?: 'credit' | 'debit' } | null): void {
    if (!tx) {
      delete this.context.activeTransaction;
    } else {
      this.context.activeTransaction = tx;
      this.context.lastEntity = {
        type: 'transaction',
        id: tx.id,
        name: `Transaction ₹${tx.amount ?? 0}`,
      };
    }
  }

  public getActiveTransaction() {
    return this.context.activeTransaction;
  }

  public setPendingConfirmation(confirmation: PendingConfirmation | undefined): void {
    this.context.pendingConfirmation = confirmation;
  }

  public getPendingConfirmation(): PendingConfirmation | undefined {
    return this.context.pendingConfirmation;
  }

  public clearPendingConfirmation(): void {
    delete this.context.pendingConfirmation;
  }

  public setPendingSlotFilling(slotFilling: PendingSlotFilling | undefined): void {
    this.context.pendingSlotFilling = slotFilling;
  }

  public getPendingSlotFilling(): PendingSlotFilling | undefined {
    return this.context.pendingSlotFilling;
  }

  public clearPendingSlotFilling(): void {
    delete this.context.pendingSlotFilling;
  }

  public setPendingField(field: string | null): void {
    this.context.pendingField = field;
  }

  public getPendingField(): string | null | undefined {
    return this.context.pendingField;
  }

  public updateFromContext(partial: Partial<ConversationContext>): void {
    if (partial.activeCustomer !== undefined) this.context.activeCustomer = partial.activeCustomer;
    if (partial.lastEntity !== undefined) this.context.lastEntity = partial.lastEntity;
    if (partial.lastAction !== undefined) this.context.lastAction = partial.lastAction;
    if (partial.lastToolResult !== undefined) this.context.lastToolResult = partial.lastToolResult;
    if (partial.currentPage !== undefined) this.context.currentPage = partial.currentPage;
    if (partial.detectedLanguage !== undefined) this.context.detectedLanguage = partial.detectedLanguage;
    if (partial.pendingField !== undefined) this.context.pendingField = partial.pendingField;
    if (partial.pendingConfirmation !== undefined) this.context.pendingConfirmation = partial.pendingConfirmation;
    if (partial.pendingSlotFilling !== undefined) this.context.pendingSlotFilling = partial.pendingSlotFilling;
  }

  public addTurn(role: 'user' | 'assistant' | 'system', text: string, lang?: 'hindi' | 'hinglish' | 'english'): void {
    this.context.recentTurns.push({
      role,
      text,
      timestamp: Date.now(),
      lang,
    });
    if (this.context.recentTurns.length > 20) {
      this.context.recentTurns = this.context.recentTurns.slice(-20);
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
    searchedName?: string;
    isPronoun?: boolean;
  } {
    const text = input.toLowerCase();

    // 1. Check for pronouns referring to active customer
    const pronounRegex = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|iski|isse|woh|same\s+customer|same\s+one|that\s+customer|him|his|her|he|them)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उससे|उनका|उनकी|उनके|उनसे|इसमें|इसका|इसकी|इससे/i;
    if (pronounRegex.test(text) && this.context.activeCustomer) {
      const active = knownCustomers.find((c) => c.id === this.context.activeCustomer?.id);
      if (active) {
        return { customer: active, isPronoun: true, searchedName: active.name };
      }
    }

    // 2. High-precision resolution against customer database
    const resolution = resolveCustomerAgainstDatabase(input, knownCustomers);
    if (resolution.status === 'EXACT' || resolution.status === 'NORMALIZED' || resolution.status === 'PHONE') {
      return { customer: resolution.customer, searchedName: resolution.searchedName };
    }
    if (resolution.status === 'AMBIGUOUS') {
      return { isAmbiguous: true, candidates: resolution.candidates, searchedName: resolution.searchedName };
    }

    // 3. Fall back to active customer if query has action without explicit customer name
    if (this.context.activeCustomer && (
      text.includes('balance') || 
      text.includes('add') || 
      text.includes('batao') || 
      text.includes('last') || 
      text.includes('उधार') || 
      text.includes('लिख') ||
      text.includes('paid') ||
      text.includes('de diye')
    )) {
      const active = knownCustomers.find((c) => c.id === this.context.activeCustomer?.id);
      if (active) return { customer: active, isPronoun: true, searchedName: active.name };
    }

    return { searchedName: resolution.searchedName };
  }

  public reset(): void {
    this.context = {
      recentTurns: [],
      currentPage: 'home',
      detectedLanguage: 'hinglish',
    };
  }
}
