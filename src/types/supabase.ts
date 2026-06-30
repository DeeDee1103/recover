export type PaymentStatus = "open" | "recovering" | "recovered" | "lost";
export type ConnectionStatus = "active" | "revoked" | "expired";
export type ConnectionMethod = "connect" | "restricted_key";
export type ReminderStatus = "pending" | "sent" | "failed" | "cancelled";
export type ReminderChannel = "email" | "sms";
export type MerchantTone = "professional" | "friendly" | "urgent" | "empathetic";

export type Database = {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string;
          auth_user_id: string;
          company_name: string | null;
          tone: MerchantTone;
          logo_url: string | null;
          primary_color: string | null;
          accent_color: string | null;
          text_color: string | null;
          email_footer_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          company_name?: string | null;
          tone?: MerchantTone;
          logo_url?: string | null;
          primary_color?: string | null;
          accent_color?: string | null;
          text_color?: string | null;
          email_footer_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          company_name?: string | null;
          tone?: MerchantTone;
          logo_url?: string | null;
          primary_color?: string | null;
          accent_color?: string | null;
          text_color?: string | null;
          email_footer_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_connections: {
        Row: {
          id: string;
          merchant_id: string;
          stripe_account_id: string;
          connection_method: ConnectionMethod;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          restricted_key_encrypted: string | null;
          status: ConnectionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          stripe_account_id: string;
          connection_method: ConnectionMethod;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          restricted_key_encrypted?: string | null;
          status?: ConnectionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          stripe_account_id?: string;
          connection_method?: ConnectionMethod;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          restricted_key_encrypted?: string | null;
          status?: ConnectionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_connections_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: true;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      end_customers: {
        Row: {
          id: string;
          merchant_id: string;
          stripe_customer_id: string;
          email: string | null;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          stripe_customer_id: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          stripe_customer_id?: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "end_customers_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      failed_payments: {
        Row: {
          id: string;
          merchant_id: string;
          stripe_invoice_id: string | null;
          stripe_charge_id: string | null;
          end_customer_id: string;
          amount: number;
          currency: string;
          failure_reason: string | null;
          failed_at: string;
          status: PaymentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          stripe_invoice_id?: string | null;
          stripe_charge_id?: string | null;
          end_customer_id: string;
          amount: number;
          currency: string;
          failure_reason?: string | null;
          failed_at?: string;
          status: PaymentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          stripe_invoice_id?: string | null;
          stripe_charge_id?: string | null;
          end_customer_id?: string;
          amount?: number;
          currency?: string;
          failure_reason?: string | null;
          failed_at?: string;
          status?: PaymentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "failed_payments_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "failed_payments_end_customer_id_fkey";
            columns: ["end_customer_id"];
            isOneToOne: false;
            referencedRelation: "end_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      sequences: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequences_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      sequence_steps: {
        Row: {
          id: string;
          sequence_id: string;
          step_order: number;
          offset_hours: number;
          subject: string;
          body_template: string;
          channel: ReminderChannel;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          step_order: number;
          offset_hours: number;
          subject: string;
          body_template: string;
          channel: ReminderChannel;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sequence_id?: string;
          step_order?: number;
          offset_hours?: number;
          subject?: string;
          body_template?: string;
          channel?: ReminderChannel;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          failed_payment_id: string;
          step_order: number;
          channel: ReminderChannel;
          scheduled_at: string;
          sent_at: string | null;
          status: ReminderStatus;
          provider_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          failed_payment_id: string;
          step_order: number;
          channel: ReminderChannel;
          scheduled_at?: string;
          sent_at?: string | null;
          status: ReminderStatus;
          provider_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          failed_payment_id?: string;
          step_order?: number;
          channel?: ReminderChannel;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: ReminderStatus;
          provider_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_failed_payment_id_fkey";
            columns: ["failed_payment_id"];
            isOneToOne: false;
            referencedRelation: "failed_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      recoveries: {
        Row: {
          id: string;
          failed_payment_id: string;
          recovered_at: string;
          amount_recovered: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          failed_payment_id: string;
          recovered_at?: string;
          amount_recovered: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          failed_payment_id?: string;
          recovered_at?: string;
          amount_recovered?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recoveries_failed_payment_id_fkey";
            columns: ["failed_payment_id"];
            isOneToOne: true;
            referencedRelation: "failed_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      processed_stripe_events: {
        Row: {
          event_id: string;
          event_type: string;
          processed_at: string;
        };
        Insert: {
          event_id: string;
          event_type: string;
          processed_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      batch_update_sequence_steps: {
        Args: {
          p_sequence_id: string;
          p_steps: unknown;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
