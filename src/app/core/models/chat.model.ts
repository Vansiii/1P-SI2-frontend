export interface Message {
  id: number;
  incident_id: number;
  sender_id: number;
  sender_name?: string;
  sender_role?: string;
  message: string;
  message_type: 'text' | 'system' | string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: number;
  incident_id: number;
  client_id: number;
  workshop_id?: number;
  workshop_name?: string;
  client_name?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
}

export interface SendMessageRequest {
  message: string;
  message_type?: 'text' | 'system';
}

export interface ChatStatistics {
  total_messages: number;
  messages_by_sender: Record<string, number>;
  first_message_at?: string;
  last_message_at?: string;
}
