export type VoiceState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'ENDING'
  | 'ERROR';

export interface PendingConfirmation {
  action: 'delete_transaction' | 'delete_customer' | 'delete_reminder' | 'custom';
  payload: any;
  message: string;
  description: string;
}

export interface PendingSlotFilling {
  action: 'add_transaction' | 'add_customer' | 'add_reminder';
  missingFields: string[];
  gathered: Record<string, any>;
  promptQuestion: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
}

export interface ConversationContext {
  activeCustomer?: {
    id: string;
    name: string;
    phone?: string;
    balance?: number;
  };
  activeTransaction?: {
    id: string;
    amount?: number;
    description?: string;
    type?: 'credit' | 'debit';
  };
  lastIntent?: string;
  lastEntities?: VoiceEntities;
  pendingConfirmation?: PendingConfirmation;
  pendingSlotFilling?: PendingSlotFilling;
  recentTurns: ConversationTurn[];
}

export interface VoiceEntities {
  customer?: string;
  customer_id?: string;
  amount?: number;
  currency?: string;
  transaction_type?: 'credit' | 'debit';
  transaction_id?: string;
  date?: string;
  time?: string;
  category?: string;
  description?: string;
  reminder?: string;
  phone_number?: string;
  page?: 'home' | 'customers' | 'billing' | 'transactions' | 'stocks';
  report_type?: 'today' | 'week' | 'month' | '7days' | 'summary';
}

export type VoiceIntentType =
  | 'ADD_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'GET_TRANSACTION'
  | 'SEARCH_TRANSACTIONS'
  | 'GET_BALANCE'
  | 'ADD_CUSTOMER'
  | 'UPDATE_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'GET_CUSTOMER'
  | 'SEARCH_CUSTOMERS'
  | 'ADD_REMINDER'
  | 'GET_REMINDERS'
  | 'UPDATE_REMINDER'
  | 'DELETE_REMINDER'
  | 'GET_REPORT'
  | 'GET_SUMMARY'
  | 'NAVIGATE'
  | 'HELP'
  | 'CANCEL'
  | 'CONFIRM'
  | 'UNKNOWN';

export interface WakeWordProvider {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
  onDetected(callback: () => void): void;
}

export interface VoiceToolCall {
  name: string;
  args: Record<string, any>;
  callId?: string;
}

export interface VoiceToolResult {
  toolName: string;
  result: any;
  callId?: string;
  error?: string;
}
