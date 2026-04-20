import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message, Conversation, SendMessageRequest } from '../models/chat.model';
import { WebSocketService } from './websocket.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/chat`;

  // Stream de mensajes nuevos en tiempo real
  private newMessageSubject = new Subject<Message>();
  public newMessage$ = this.newMessageSubject.asObservable();

  // Estado de mensajes por incidente
  private messagesCache = new Map<number, BehaviorSubject<Message[]>>();

  // Estado de contador de no leídos
  private unreadCountSubject = new BehaviorSubject<Map<number, number>>(new Map());
  public unreadCount$ = this.unreadCountSubject.asObservable();

  // Typing indicators: Map<incident_id, user_names[]>
  private typingUsersSubject = new BehaviorSubject<Map<number, string[]>>(new Map());
  public typingUsers$: Observable<Map<number, string[]>> = this.typingUsersSubject.asObservable();

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Suscribirse a eventos WebSocket para mensajes en tiempo real
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'new_message':
          this.handleNewMessage(message.data);
          break;
        case 'new_chat_message':
          this.handleNewChatMessage(message.data);
          break;
        case 'user_typing':
          this.handleUserTyping(message.data);
          break;
        case 'user_stopped_typing':
          this.handleUserStoppedTyping(message.data);
          break;
        case 'message_read':
          this.handleMessageRead(message.data);
          break;
      }
    });
  }

  /**
   * Send typing_start event to the server for a given incident
   */
  public sendTypingStart(incidentId: number): void {
    this.wsService.send({ type: 'typing_start', incident_id: incidentId });
  }

  /**
   * Send typing_stop event to the server for a given incident
   */
  public sendTypingStop(incidentId: number): void {
    this.wsService.send({ type: 'typing_stop', incident_id: incidentId });
  }

  /**
   * Handle user_typing event: add user_name to the typing map for that incident
   */
  private handleUserTyping(data: any): void {
    try {
      const { incident_id, user_name } = data;
      if (!incident_id || !user_name) return;

      const current = new Map(this.typingUsersSubject.value);
      const names = current.get(incident_id) ?? [];
      if (!names.includes(user_name)) {
        current.set(incident_id, [...names, user_name]);
        this.typingUsersSubject.next(current);
      }
    } catch (error) {
      console.error('Error handling user_typing event:', error);
    }
  }

  /**
   * Handle user_stopped_typing event: remove user_name from the typing map
   */
  private handleUserStoppedTyping(data: any): void {
    try {
      const { incident_id, user_name } = data;
      if (!incident_id || !user_name) return;

      const current = new Map(this.typingUsersSubject.value);
      const names = (current.get(incident_id) ?? []).filter(n => n !== user_name);
      if (names.length === 0) {
        current.delete(incident_id);
      } else {
        current.set(incident_id, names);
      }
      this.typingUsersSubject.next(current);
    } catch (error) {
      console.error('Error handling user_stopped_typing event:', error);
    }
  }

  /**
   * Handle message_read event: update is_read on messages in the cache
   * for messages NOT sent by the reader (i.e. messages the reader just read)
   */
  private handleMessageRead(data: any): void {
    try {
      const { incident_id, read_by_user_id } = data;
      if (!incident_id || !read_by_user_id) return;

      const messagesSubject = this.messagesCache.get(incident_id);
      if (!messagesSubject) return;

      const updated = messagesSubject.value.map(msg => {
        // Mark as read all messages NOT sent by the reader
        if (msg.sender_id !== read_by_user_id && !msg.is_read) {
          return { ...msg, is_read: true };
        }
        return msg;
      });

      messagesSubject.next(updated);
    } catch (error) {
      console.error('Error handling message_read event:', error);
    }
  }

  /**
   * Manejar nuevo mensaje recibido por WebSocket (formato antiguo)
   */
  private handleNewMessage(data: any): void {
    try {
      const message: Message = {
        id: data.id,
        incident_id: data.incident_id,
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        message: data.message,
        message_type: data.type || data.message_type || 'text',
        is_read: data.is_read || false,
        created_at: data.created_at
      };

      this.processNewMessage(message);
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  }

  /**
   * Manejar nuevo mensaje de chat recibido por WebSocket (formato nuevo)
   */
  private handleNewChatMessage(data: any): void {
    try {
      const message: Message = {
        id: data.id,
        incident_id: data.incident_id,
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        sender_role: data.sender_role,
        message: data.message,
        message_type: data.message_type || 'text',
        is_read: data.is_read || false,
        read_at: data.read_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      this.processNewMessage(message);
      
      console.log(`💬 New chat message received for incident ${message.incident_id} from ${message.sender_name}`);
    } catch (error) {
      console.error('Error handling new chat message:', error);
    }
  }

  /**
   * Procesar nuevo mensaje (común para ambos formatos)
   */
  private processNewMessage(message: Message): void {
    // Emitir mensaje nuevo
    this.newMessageSubject.next(message);

    // Actualizar cache de mensajes si existe
    const messagesSubject = this.messagesCache.get(message.incident_id);
    if (messagesSubject) {
      const currentMessages = messagesSubject.value;
      // Evitar duplicados
      if (!currentMessages.some(m => m.id === message.id)) {
        // Agregar al final (orden cronológico)
        messagesSubject.next([...currentMessages, message]);
      }
    }

    // Actualizar contador de no leídos
    this.incrementUnreadCount(message.incident_id);
  }

  /**
   * Obtener observable de mensajes para un incidente específico
   */
  public getMessagesObservable(incidentId: number): Observable<Message[]> {
    if (!this.messagesCache.has(incidentId)) {
      this.messagesCache.set(incidentId, new BehaviorSubject<Message[]>([]));
      // Cargar mensajes iniciales
      this.loadMessagesForIncident(incidentId);
    }
    return this.messagesCache.get(incidentId)!.asObservable();
  }

  /**
   * Cargar mensajes iniciales para un incidente
   */
  private loadMessagesForIncident(incidentId: number): void {
    this.getMessages(incidentId).subscribe({
      next: (messages) => {
        const messagesSubject = this.messagesCache.get(incidentId);
        if (messagesSubject) {
          messagesSubject.next(messages);
        }
      },
      error: (error) => {
        console.error(`Error loading messages for incident ${incidentId}:`, error);
      }
    });
  }

  /**
   * Incrementar contador de no leídos
   */
  private incrementUnreadCount(incidentId: number): void {
    const currentCounts = this.unreadCountSubject.value;
    const currentCount = currentCounts.get(incidentId) || 0;
    currentCounts.set(incidentId, currentCount + 1);
    this.unreadCountSubject.next(new Map(currentCounts));
  }

  /**
   * Resetear contador de no leídos
   */
  public resetUnreadCount(incidentId: number): void {
    const currentCounts = this.unreadCountSubject.value;
    currentCounts.set(incidentId, 0);
    this.unreadCountSubject.next(new Map(currentCounts));
  }

  /**
   * Get or create conversation for an incident
   */
  getIncidentConversation(incidentId: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.apiUrl}/incidents/${incidentId}/conversation`);
  }

  /**
   * Get messages for an incident
   */
  getMessages(
    incidentId: number,
    limit: number = 50,
    offset: number = 0,
    beforeId?: number
  ): Observable<Message[]> {
    let params: any = { limit, offset };
    if (beforeId) {
      params.before_id = beforeId;
    }
    return this.http.get<Message[]>(`${this.apiUrl}/incidents/${incidentId}/messages`, { params });
  }

  /**
   * Send a message in an incident conversation
   */
  sendMessage(incidentId: number, request: SendMessageRequest): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/incidents/${incidentId}/messages`, request);
  }

  /**
   * Mark messages as read
   */
  markMessagesAsRead(incidentId: number): Observable<{ marked_count: number }> {
    return this.http.post<{ marked_count: number }>(
      `${this.apiUrl}/incidents/${incidentId}/messages/mark-read`,
      {}
    );
  }

  /**
   * Get unread count for an incident
   */
  getUnreadCount(incidentId: number): Observable<{ unread_count: number }> {
    return this.http.get<{ unread_count: number }>(
      `${this.apiUrl}/incidents/${incidentId}/unread-count`
    );
  }

  /**
   * Get all conversations for current user
   */
  getUserConversations(limit: number = 20): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversations`, { params: { limit } });
  }

  /**
   * Delete a message
   */
  deleteMessage(messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/messages/${messageId}`);
  }
}
