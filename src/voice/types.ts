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
  lang?: 'hindi' | 'hinglish' | 'english';
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
  lastEntity?: {
    type: 'customer' | 'transaction' | 'invoice' | 'product';
    id: string;
    name: string;
  };
  lastAction?: string;
  lastToolResult?: any;
  pendingAction?: any;
  pendingConfirmation?: PendingConfirmation;
  pendingSlotFilling?: PendingSlotFilling;
  pendingField?: string | null;
  currentPage?: string;
  detectedLanguage?: 'hindi' | 'hinglish' | 'english';
  lastIntent?: string;
  lastEntities?: VoiceEntities;
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

export type PlannedActionType =
  | 'NAVIGATE'
  | 'CREATE_CUSTOMER'
  | 'UPDATE_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'GET_CUSTOMER'
  | 'GET_CUSTOMER_BALANCE'
  | 'GET_CUSTOMER_HISTORY'
  | 'ADD_CUSTOMER_DEBT'
  | 'RECORD_PAYMENT'
  | 'GET_ACCOUNT_SUMMARY'
  | 'CREATE_SALE'
  | 'MANAGE_STOCK'
  | 'ADD_REMINDER'
  | 'GET_REMINDERS'
  | 'DELETE_TRANSACTION'
  | 'END_CONVERSATION'
  | 'ASK_CLARIFICATION';

export interface PlannedAction {
  action: PlannedActionType;
  parameters: Record<string, any>;
  description?: string;
}

export interface SemanticActionPlan {
  detectedLanguage: 'hindi' | 'hinglish' | 'english';
  primaryIntent: string;
  userGoalSummary: string;
  entities: {
    customerName?: string | null;
    amount?: number | null;
    paymentMethod?: string | null;
    navigationTarget?: string | null;
    productName?: string | null;
    quantity?: number | null;
    dueDate?: string | null;
    note?: string | null;
    [key: string]: any;
  };
  references: {
    isPronounOrReference: boolean;
    refersTo: 'active_customer' | 'new_customer' | 'account' | 'none';
    resolvedCustomerName?: string | null;
  };
  missingInformation: string[];
  ambiguities: string[];
  clarificationQuestion?: string | null;
  actions: PlannedAction[];
}

export interface ExecutionResult {
  action: PlannedActionType;
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export interface VoiceServerResponse {
  reply: string;
  plan?: SemanticActionPlan;
  executionResults?: ExecutionResult[];
  updatedCustomer?: any;
  newTransaction?: any;
  toolCall?: {
    name: string;
    args: any;
  };
  toolCalls?: Array<{
    name: string;
    args: any;
  }>;
  updatedContext?: Partial<ConversationContext>;
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
