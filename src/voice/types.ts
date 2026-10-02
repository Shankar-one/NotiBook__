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
  | 'ADD_RECEIVABLE'
  | 'ADD_PAYMENT_GIVEN'
  | 'RECORD_PAYMENT_RECEIVED'
  | 'GET_LEDGER'
  | 'GET_TOTAL_RECEIVABLE'
  | 'GET_TOTAL_PAYABLE'
  | 'GET_TRANSACTIONS'
  | 'CREATE_CUSTOMER'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'CANCEL_LAST_ACTION'
  | 'NAVIGATE'
  | 'END_CONVERSATION'
  | 'UNKNOWN';

export interface StructuredVoiceInterpretation {
  intent: StrictVoiceIntent;
  secondary_intent?: StrictVoiceIntent | null;
  person_name: string | null;
  amount: number | null;
  currency: string;
  description: string | null;
  date: string | null;
  confidence: number;
  requires_confirmation: boolean;
  is_addition_to_existing?: boolean;
  existing_balance?: number | null;
  new_balance_preview?: number | null;
  clarification_question?: string | null;
  detected_language?: 'hindi' | 'hinglish' | 'english';
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
  customerId?: string;
  amount: number | null;
  currency: string;
  description?: string | null;
  paymentMode?: 'Cash' | 'UPI' | 'Bank' | 'Credit';
  isAdditionToExisting?: boolean;
  existingBalance?: number;
  newBalancePreview?: number;
  customerExists?: boolean;
  payload: any;
  message: string;
  summaryTitle: string;
  lang: 'hindi' | 'hinglish' | 'english';
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
  pendingClarification?: {
    personName?: string | null;
    amount?: number | null;
    intent?: StrictVoiceIntent | null;
  };
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
  | 'ADD_RECEIVABLE'
  | 'ADD_PAYMENT_GIVEN'
  | 'RECORD_PAYMENT'
  | 'RECORD_PAYMENT_RECEIVED'
  | 'GET_LEDGER'
  | 'GET_TOTAL_RECEIVABLE'
  | 'GET_TOTAL_PAYABLE'
  | 'GET_TRANSACTIONS'
  | 'GET_ACCOUNT_SUMMARY'
  | 'CREATE_SALE'
  | 'MANAGE_STOCK'
  | 'ADD_REMINDER'
  | 'GET_REMINDERS'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'CANCEL_LAST_ACTION'
  | 'END_CONVERSATION'
  | 'ASK_CLARIFICATION';

export interface PlannedAction {
  action: PlannedActionType;
  parameters: Record<string, any>;
  description?: string;
}

export interface SemanticActionPlan {
  detectedLanguage: 'hindi' | 'hinglish' | 'english';
  primaryIntent: StrictVoiceIntent | string;
  userGoalSummary: string;
  structuredInterpretation?: StructuredVoiceInterpretation;
  requiresConfirmation?: boolean;
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
