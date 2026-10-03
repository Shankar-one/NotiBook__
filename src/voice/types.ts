export type VoiceState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'ENDING'
  | 'ERROR';

export type StrictVoiceIntent =
  | 'CREATE_CUSTOMER'
  | 'GET_CUSTOMER'
  | 'SEARCH_CUSTOMERS'
  | 'UPDATE_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'ADD_RECEIVABLE'
  | 'ADD_PAYABLE'
  | 'ADD_PAYMENT_GIVEN'
  | 'RECORD_PAYMENT_RECEIVED'
  | 'GET_BALANCE'
  | 'GET_LEDGER'
  | 'GET_TOTAL_RECEIVABLE'
  | 'GET_TOTAL_PAYABLE'
  | 'GET_TRANSACTIONS'
  | 'GET_LAST_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'NAVIGATE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'CANCEL_LAST_ACTION'
  | 'MODIFY_PENDING'
  | 'END_CONVERSATION'
  | 'CREATE_SALE'
  | 'GET_STOCK'
  | 'GET_PRODUCT_PRICE'
  | 'ADJUST_STOCK'
  | 'UNKNOWN';

export interface StructuredVoiceInterpretation {
  intent: StrictVoiceIntent;
  secondary_intent?: StrictVoiceIntent | null;
  customer_name: string | null;
  person_name: string | null;
  customer_id?: string | null;
  amount: number | null;
  currency: string;
  transaction_type?: 'receivable' | 'payable' | 'payment_received' | 'payment_given' | 'credit' | 'debit' | null;
  description: string | null;
  date: string | null;
  time?: string | null;
  transaction_id?: string | null;
  page?: string | null;
  confidence: number;
  requires_confirmation: boolean;
  is_addition_to_existing?: boolean;
  existing_balance?: number | null;
  new_balance_preview?: number | null;
  clarification_question?: string | null;
  detected_language?: 'english' | 'hindi' | 'hinglish';
  navigation_target?: string | null;
}

export interface PendingConfirmation {
  id: string;
  action:
    | 'execute_intent'
    | 'delete_transaction'
    | 'delete_customer'
    | 'delete_reminder'
    | 'custom';
  intent: StrictVoiceIntent;
  secondaryIntent?: StrictVoiceIntent | null;
  personName: string;
  customer_name?: string;
  customerId?: string;
  customer_id?: string;
  amount: number | null;
  currency: string;
  transactionType?: 'receivable' | 'payable' | 'payment_received' | 'payment_given' | 'credit' | 'debit';
  description?: string | null;
  paymentMode?: 'Cash' | 'UPI' | 'Bank' | 'Credit';
  isAdditionToExisting?: boolean;
  existingBalance?: number;
  newBalancePreview?: number;
  customerExists?: boolean;
  payload: any;
  message: string;
  summaryTitle: string;
  lang: 'english' | 'hindi' | 'hinglish';
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
  lang?: 'english' | 'hindi' | 'hinglish';
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
    type?: 'credit' | 'debit' | 'in' | 'out';
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
  pendingClarification?: {
    personName?: string | null;
    customerId?: string | null;
    amount?: number | null;
    intent?: StrictVoiceIntent | null;
  };
  pendingField?: string | null;
  currentPage?: string;
  detectedLanguage?: 'english' | 'hindi' | 'hinglish';
  lastIntent?: string;
  lastEntities?: VoiceEntities;
  recentTurns: ConversationTurn[];
}

export interface VoiceEntities {
  customer?: string;
  customer_name?: string;
  customer_id?: string;
  amount?: number;
  currency?: string;
  transaction_type?: 'credit' | 'debit' | 'receivable' | 'payable';
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
  | 'CREATE_CUSTOMER'
  | 'GET_CUSTOMER'
  | 'SEARCH_CUSTOMERS'
  | 'UPDATE_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'ADD_RECEIVABLE'
  | 'ADD_PAYABLE'
  | 'ADD_CUSTOMER_DEBT'
  | 'ADD_PAYMENT_GIVEN'
  | 'RECORD_PAYMENT'
  | 'RECORD_PAYMENT_RECEIVED'
  | 'GET_BALANCE'
  | 'GET_CUSTOMER_BALANCE'
  | 'GET_LEDGER'
  | 'GET_TOTAL_RECEIVABLE'
  | 'GET_TOTAL_PAYABLE'
  | 'GET_TRANSACTIONS'
  | 'GET_LAST_TRANSACTION'
  | 'GET_CUSTOMER_HISTORY'
  | 'GET_ACCOUNT_SUMMARY'
  | 'CREATE_SALE'
  | 'MANAGE_STOCK'
  | 'ADD_REMINDER'
  | 'GET_REMINDERS'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'NAVIGATE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'CANCEL_LAST_ACTION'
  | 'MODIFY_PENDING'
  | 'END_CONVERSATION'
  | 'ASK_CLARIFICATION';

export interface PlannedAction {
  action: PlannedActionType;
  parameters: Record<string, any>;
  description?: string;
}

export interface SemanticActionPlan {
  detectedLanguage: 'english' | 'hindi' | 'hinglish';
  primaryIntent: StrictVoiceIntent | string;
  userGoalSummary: string;
  structuredInterpretation?: StructuredVoiceInterpretation;
  requiresConfirmation?: boolean;
  naturalResponseSuggestion?: string | null;
  entities: {
    customerName?: string | null;
    customerId?: string | null;
    amount?: number | null;
    transactionType?: string | null;
    paymentMethod?: string | null;
    navigationTarget?: string | null;
    page?: string | null;
    productName?: string | null;
    quantity?: number | null;
    dueDate?: string | null;
    time?: string | null;
    transactionId?: string | null;
    note?: string | null;
    description?: string | null;
    [key: string]: any;
  };
  references: {
    isPronounOrReference: boolean;
    refersTo: 'active_customer' | 'new_customer' | 'account' | 'pending_confirmation' | 'none';
    resolvedCustomerName?: string | null;
    resolvedCustomerId?: string | null;
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
  structuredInterpretation?: StructuredVoiceInterpretation;
  requiresConfirmation?: boolean;
  pendingConfirmation?: PendingConfirmation;
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

export type VoiceIntentType = StrictVoiceIntent;

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
