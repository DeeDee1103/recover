export type FailedPaymentStatus = "open" | "recovering" | "recovered" | "lost";
export type ConnectionMethod = "connect" | "restricted_key";
export type ConnectionStatus = "active" | "revoked";
export type ReminderStatus = "pending" | "sent" | "cancelled";
export type Channel = "email";

export interface Merchant {
  id: string;
  auth_user_id: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface StripeConnection {
  id: string;
  merchant_id: string;
  stripe_account_id: string;
  connection_method: ConnectionMethod;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface EndCustomer {
  id: string;
  merchant_id: string;
  stripe_customer_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FailedPayment {
  id: string;
  merchant_id: string;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  end_customer_id: string;
  amount: number;
  currency: string;
  failure_reason: string | null;
  failed_at: string;
  status: FailedPaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface Sequence {
  id: string;
  merchant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  offset_hours: number;
  subject: string;
  body_template: string;
  channel: Channel;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  failed_payment_id: string;
  step_order: number;
  channel: Channel;
  scheduled_at: string;
  sent_at: string | null;
  status: ReminderStatus;
  provider_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recovery {
  id: string;
  failed_payment_id: string;
  recovered_at: string;
  amount_recovered: number;
  created_at: string;
}
