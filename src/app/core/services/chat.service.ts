import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Message, MessageStatus, Conversation, SendMessageRequest } from '../models/chat.model';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/chat`;

  private newMessageSubject = new Subject<Message>();
  public newMessage$ = this.newMessageSubject.asObservable();

  private messagesCache = new Map<number, BehaviorSubject<Message[]>>();
  private activeConversationIds = new Map<number, number>();

  private unreadCountSubject = new BehaviorSubject<Map<number, number>>(new Map());
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<Map<number, string[]>>(new Map());
  public typingUsers$: Observable<Map<number, string[]>> = this.typingUsersSubject.asObservable();
  private typingUsersById = new Map<number, Map<number, string>>();

  constructor() {
    this.subscribeToWebSocket();
  }

  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'new_message':
          this.handleNewMessage(message.data);
          break;
        case 'new_chat_message':
          this.handleNewChatMessage(message.data);
          break;
        case 'chat.message_sent':
          this.handleChatMessageSent(message.data);
          break;
        case 'chat.user_typing':
        case 'user_typing':
          this.handleUserTyping(message.data);
          break;
        case 'chat.user_stopped_typing':
        case 'user_stopped_typing':
          this.handleUserStoppedTyping(message.data);
          break;
        case 'chat.message_delivered':
          this.handleMessageDelivered(message.data);
          break;
        case 'chat.message_read':
        case 'message_read':
          this.handleMessageRead(message.data);
          break;
        case 'incident.status_changed':
        case 'incident_status_change':
        case 'incident_status_changed':
          this.handleIncidentStatusChanged(message.data);
          break;
        case 'incident.assignment_accepted':
        case 'incident_assignment_accepted':
          this.handleAssignmentAccepted(message.data);
          break;
      }
    });
  }

  private handleAssignmentAccepted(data: any): void {
    const incidentId = this.toNumber(data?.incident_id);
    const conversationId = this.toNumber(data?.conversation_id);
    if (!incidentId || !conversationId) return;
    this.setActiveConversation(incidentId, conversationId);
  }

  private handleIncidentStatusChanged(data: any): void {
    const incidentId = this.toNumber(data?.incident_id);
    const newStatus = String(data?.new_status ?? data?.estado_actual ?? '').trim().toLowerCase();
    const reason = String(data?.reason ?? '').trim().toLowerCase();
    if (!incidentId) return;

    if (
      newStatus === 'pendiente' &&
      ['mutual_cancellation', 'ambiguous_case_cancelled', 'ambiguous_case_cancelled_manual'].includes(reason)
    ) {
      this.clearIncidentChat(incidentId);
    }
  }

  public sendTypingStart(incidentId: number): void {
    this.sendTypingIndicatorHTTP(incidentId).subscribe({
      error: () => {
        this.wsService.send({ type: 'typing_start', incident_id: incidentId });
      }
    });
  }

  public sendTypingStop(incidentId: number): void {
    this.sendTypingStopIndicatorHTTP(incidentId).subscribe({
      error: () => {
        this.wsService.send({ type: 'typing_stop', incident_id: incidentId });
      }
    });
  }

  private handleUserTyping(data: any): void {
    try {
      const incidentId = this.toNumber(data?.incident_id);
      const userId = this.toNumber(data?.user_id);
      const rawName = typeof data?.user_name === 'string' ? data.user_name.trim() : '';
      if (!incidentId) return;

      const ownId = this.authService.currentUser()?.id;
      if (ownId != null && userId === ownId) return;

      const userName = rawName || this.resolveUserName(incidentId, userId) || (userId !== null ? `Usuario ${userId}` : null);
      if (!userName) return;

      const current = new Map(this.typingUsersSubject.value);
      const names = current.get(incidentId) ?? [];
      if (!names.includes(userName)) {
        current.set(incidentId, [...names, userName]);
        this.typingUsersSubject.next(current);
      }

      if (userId !== null) {
        const byId = new Map(this.typingUsersById.get(incidentId) ?? new Map<number, string>());
        byId.set(userId, userName);
        this.typingUsersById.set(incidentId, byId);
      }
    } catch (error) {
      console.error('Error handling user_typing event:', error);
    }
  }

  private handleUserStoppedTyping(data: any): void {
    try {
      const incidentId = this.toNumber(data?.incident_id);
      const userId = this.toNumber(data?.user_id);
      const rawName = typeof data?.user_name === 'string' ? data.user_name.trim() : '';
      if (!incidentId) return;

      const byId = this.typingUsersById.get(incidentId) ?? new Map<number, string>();
      const userName = rawName || (userId !== null ? byId.get(userId) : undefined) || this.resolveUserName(incidentId, userId);

      const current = new Map(this.typingUsersSubject.value);
      const currentNames = current.get(incidentId) ?? [];
      const names = userName
        ? currentNames.filter(n => n !== userName)
        : [];
      if (names.length === 0) {
        current.delete(incidentId);
      } else {
        current.set(incidentId, names);
      }
      this.typingUsersSubject.next(current);

      if (userId !== null && byId.has(userId)) {
        const updatedById = new Map(byId);
        updatedById.delete(userId);
        if (updatedById.size === 0) {
          this.typingUsersById.delete(incidentId);
        } else {
          this.typingUsersById.set(incidentId, updatedById);
        }
      }
    } catch (error) {
      console.error('Error handling user_stopped_typing event:', error);
    }
  }

  private handleMessageDelivered(data: any): void {
    try {
      const incidentIdFromPayload = this.toNumber(data?.incident_id);
      const messageId = this.toNumber(data?.message_id);
      const incidentId = incidentIdFromPayload ?? this.findIncidentIdByMessageId(messageId);
      if (!incidentId || messageId === null) return;

      const messagesSubject = this.messagesCache.get(incidentId);
      if (!messagesSubject) return;

      const deliveredAt = data?.delivered_at
        ? this.normalizeTimestamp(String(data.delivered_at))
        : undefined;

      const updated = messagesSubject.value.map((message) => {
        if (Number(message.id) !== messageId) return message;
        return {
          ...message,
          status: (message.is_read ? 'read' : 'delivered') as MessageStatus,
          updated_at: deliveredAt ?? message.updated_at
        };
      });

      messagesSubject.next(updated);
    } catch (error) {
      console.error('Error handling message_delivered event:', error);
    }
  }

  private handleMessageRead(data: any): void {
    try {
      const incidentIdFromPayload = this.toNumber(data?.incident_id);
      const messageId = this.toNumber(data?.message_id);
      const incidentId = incidentIdFromPayload ?? this.findIncidentIdByMessageId(messageId);
      const readByUserId = this.toNumber(data?.read_by_user_id ?? data?.read_by);
      if (!incidentId || readByUserId === null) return;

      const messagesSubject = this.messagesCache.get(incidentId);
      if (!messagesSubject) return;

      const readAt = data?.read_at
        ? this.normalizeTimestamp(String(data.read_at))
        : undefined;

      const updated = messagesSubject.value.map((message) => {
        const mustUpdate = messageId !== null
          ? Number(message.id) === messageId
          : (message.sender_id !== readByUserId && !message.is_read);

        if (!mustUpdate) return message;

        return {
          ...message,
          is_read: true,
          read_at: readAt ?? message.read_at,
          status: 'read' as MessageStatus
        };
      });

      messagesSubject.next(updated);
    } catch (error) {
      console.error('Error handling message_read event:', error);
    }
  }

  private handleNewMessage(data: any): void {
    try {
      const message = this.normalizeMessage(data);
      if (!message) return;
      this.processNewMessage(message);
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  }

  private handleNewChatMessage(data: any): void {
    try {
      const message = this.normalizeMessage(data);
      if (!message) return;
      this.processNewMessage(message);
    } catch (error) {
      console.error('Error handling new chat message:', error);
    }
  }

  private handleChatMessageSent(data: any): void {
    try {
      const message = this.normalizeMessage(data);
      if (!message) return;
      this.processNewMessage(message);
    } catch (error) {
      console.error('Error handling chat.message_sent event:', error, data);
    }
  }

  private processNewMessage(message: Message): void {
    const activeConversationId = this.activeConversationIds.get(message.incident_id);
    if (message.conversation_id && activeConversationId && activeConversationId !== message.conversation_id) {
      this.clearIncidentChat(message.incident_id);
    }
    if (message.conversation_id) {
      this.activeConversationIds.set(message.incident_id, message.conversation_id);
    }

    this.newMessageSubject.next(message);

    let messagesSubject = this.messagesCache.get(message.incident_id);
    if (!messagesSubject) {
      messagesSubject = new BehaviorSubject<Message[]>([]);
      this.messagesCache.set(message.incident_id, messagesSubject);
    }

    const currentMessages = messagesSubject.value;
    const existingIndex = currentMessages.findIndex(m => Number(m.id) === Number(message.id));
    const isNewMessage = existingIndex === -1;

    const mergedMessages = isNewMessage
      ? [...currentMessages, message]
      : currentMessages.map((m, index) => (
          index === existingIndex ? { ...m, ...message } : m
        ));

    const updatedMessages = this.dedupeMessages(mergedMessages);

    messagesSubject.next(updatedMessages);

    if (isNewMessage) {
      this.incrementUnreadCount(message.incident_id);
    }
  }

  public getMessagesObservable(incidentId: number): Observable<Message[]> {
    if (!this.messagesCache.has(incidentId)) {
      this.messagesCache.set(incidentId, new BehaviorSubject<Message[]>([]));
      this.loadMessagesForIncident(incidentId);
    }
    return this.messagesCache.get(incidentId)!.asObservable();
  }

  private loadMessagesForIncident(incidentId: number): void {
    this.getIncidentConversation(incidentId).subscribe({
      next: (conversation) => {
        this.setActiveConversation(incidentId, Number(conversation?.id));
        this.getMessages(incidentId).subscribe({
          next: (messages) => {
            const messagesSubject = this.messagesCache.get(incidentId);
            if (!messagesSubject) return;

            const normalized = messages
              .map((message) => this.normalizeMessage(message))
              .filter((message): message is Message => !!message)
              .filter((message) => !conversation.id || message.conversation_id === conversation.id);
            messagesSubject.next(this.dedupeMessages(normalized));
          },
          error: (error) => {
            console.error(`Error loading messages for incident ${incidentId}:`, error);
          }
        });
      },
      error: () => {
        this.clearIncidentChat(incidentId);
      }
    });
  }

  private incrementUnreadCount(incidentId: number): void {
    const currentCounts = this.unreadCountSubject.value;
    const currentCount = currentCounts.get(incidentId) || 0;
    currentCounts.set(incidentId, currentCount + 1);
    this.unreadCountSubject.next(new Map(currentCounts));
  }

  public resetUnreadCount(incidentId: number): void {
    const currentCounts = this.unreadCountSubject.value;
    currentCounts.set(incidentId, 0);
    this.unreadCountSubject.next(new Map(currentCounts));
  }

  getIncidentConversation(incidentId: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.apiUrl}/incidents/${incidentId}/conversation`).pipe(
      tap((conversation) => this.setActiveConversation(incidentId, Number(conversation?.id)))
    );
  }

  getMessages(
    incidentId: number,
    limit = 50,
    offset = 0,
    beforeId?: number
  ): Observable<Message[]> {
    const params: any = { limit, offset };
    if (beforeId) {
      params.before_id = beforeId;
    }
    return this.http.get<Message[]>(`${this.apiUrl}/incidents/${incidentId}/messages`, { params });
  }

  sendMessage(incidentId: number, request: SendMessageRequest): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/incidents/${incidentId}/messages`, request).pipe(
      tap((response) => {
        // Ensure own sent messages are present in cache so delivered/read WS events
        // can update their status in real time without waiting for a full reload.
        const normalized = this.normalizeMessage(response);
        if (normalized) {
          this.upsertMessageInCache(normalized);
        }
      })
    );
  }

  markMessagesAsRead(incidentId: number): Observable<{ marked_count: number }> {
    return this.http.post<{ marked_count: number }>(
      `${this.apiUrl}/incidents/${incidentId}/messages/mark-read`,
      {}
    );
  }

  getUnreadCount(incidentId: number): Observable<{ unread_count: number }> {
    return this.http.get<{ unread_count: number }>(
      `${this.apiUrl}/incidents/${incidentId}/unread-count`
    );
  }

  getUserConversations(limit = 20): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversations`, { params: { limit } });
  }

  deleteMessage(messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/messages/${messageId}`);
  }

  sendTypingIndicatorHTTP(incidentId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/incidents/${incidentId}/typing`, {});
  }

  sendTypingStopIndicatorHTTP(incidentId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/incidents/${incidentId}/typing/stop`, {});
  }

  markMessageAsRead(messageId: number): Observable<{ read_at: string }> {
    return this.http.post<{ read_at: string }>(`${this.apiUrl}/messages/${messageId}/read`, {});
  }

  private toNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeMessage(data: any): Message | null {
    if (!data) return null;

    const id = this.toNumber(data.id ?? data.message_id);
    const incidentId = this.toNumber(data.incident_id);
    const senderId = this.toNumber(data.sender_id ?? data.senderId);
    const content = data.message ?? data.content ?? data.text;

    if (!id || !incidentId || senderId === null || !content) {
      return null;
    }

    return {
      id,
      conversation_id: this.toNumber(data.conversation_id) ?? 0,
      incident_id: incidentId,
      sender_id: senderId,
      sender_name: data.sender_name,
      sender_role: data.sender_role,
      message: String(content),
      message_type: data.message_type || 'text',
      is_read: Boolean(data.is_read),
      read_at: data.read_at,
      created_at: this.normalizeTimestamp(data.created_at || data.sent_at || new Date().toISOString()),
      updated_at: data.updated_at,
      status: (data.read_at || data.is_read
        ? 'read'
        : (data.delivered_at ? 'delivered' : 'sent')) as MessageStatus
    };
  }

  private findIncidentIdByMessageId(messageId: number | null): number | null {
    if (messageId === null) return null;
    for (const [incidentId, subject] of this.messagesCache.entries()) {
      if (subject.value.some((message) => Number(message.id) === messageId)) {
        return incidentId;
      }
    }
    return null;
  }

  private resolveUserName(incidentId: number, userId: number | null): string | null {
    if (userId === null) return null;
    const messages = this.messagesCache.get(incidentId)?.value ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (Number(message.sender_id) === userId && message.sender_name) {
        return message.sender_name;
      }
    }
    return null;
  }

  private toDate(value: string): Date {
    const normalized = this.normalizeTimestamp(value);
    return new Date(normalized);
  }

  private normalizeTimestamp(value: string): string {
    const timestamp = String(value ?? '').trim();
    if (!timestamp) return new Date().toISOString();

    const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(timestamp);
    if (hasTimezone) return timestamp;
    return `${timestamp}Z`;
  }

  private upsertMessageInCache(message: Message): void {
    let messagesSubject = this.messagesCache.get(message.incident_id);
    if (!messagesSubject) {
      messagesSubject = new BehaviorSubject<Message[]>([]);
      this.messagesCache.set(message.incident_id, messagesSubject);
    }

    const currentMessages = messagesSubject.value;
    const existingIndex = currentMessages.findIndex(m => Number(m.id) === Number(message.id));
    const mergedMessages = existingIndex === -1
      ? [...currentMessages, message]
      : currentMessages.map((m, index) => (
          index === existingIndex ? { ...m, ...message } : m
        ));

    const sorted = this.dedupeMessages(mergedMessages);

    messagesSubject.next(sorted);
  }

  private dedupeMessages(messages: Message[]): Message[] {
    const sorted = [...messages].sort(
      (a, b) => this.toDate(a.created_at).getTime() - this.toDate(b.created_at).getTime()
    );

    const deduped: Message[] = [];

    for (const message of sorted) {
      const byIdIndex = deduped.findIndex(
        (entry) => Number(entry.id) === Number(message.id)
      );

      if (byIdIndex !== -1) {
        deduped[byIdIndex] = { ...deduped[byIdIndex], ...message };
        continue;
      }

      const lastMessage = deduped[deduped.length - 1];
      if (lastMessage && this.isDuplicateSystemMessage(lastMessage, message)) {
        deduped[deduped.length - 1] = { ...lastMessage, ...message };
        continue;
      }

      deduped.push(message);
    }

    return deduped;
  }

  private isDuplicateSystemMessage(previous: Message, incoming: Message): boolean {
    if (previous.message_type !== 'system' || incoming.message_type !== 'system') {
      return false;
    }

    if (
      previous.conversation_id !== incoming.conversation_id ||
      previous.incident_id !== incoming.incident_id ||
      previous.sender_id !== incoming.sender_id
    ) {
      return false;
    }

    const previousText = previous.message.trim();
    const incomingText = incoming.message.trim();
    if (!previousText || previousText !== incomingText) {
      return false;
    }

    const previousTime = this.toDate(previous.created_at).getTime();
    const incomingTime = this.toDate(incoming.created_at).getTime();
    return Math.abs(incomingTime - previousTime) <= 2 * 60 * 1000;
  }

  getActiveConversationId(incidentId: number): number | null {
    return this.activeConversationIds.get(incidentId) ?? null;
  }

  clearIncidentChat(
    incidentId: number,
    options: { emitEmpty?: boolean } = {}
  ): void {
    const subject = this.messagesCache.get(incidentId);
    if (options.emitEmpty !== false && subject) {
      subject.next([]);
    }
    this.activeConversationIds.delete(incidentId);
    try {
      localStorage.removeItem(`chat_${incidentId}`);
    } catch {}
  }

  private setActiveConversation(incidentId: number, conversationId: number | null): void {
    if (!conversationId || !Number.isFinite(conversationId) || conversationId <= 0) {
      return;
    }

    const previousConversationId = this.activeConversationIds.get(incidentId);
    if (previousConversationId && previousConversationId !== conversationId) {
      this.clearIncidentChat(incidentId);
    }

    this.activeConversationIds.set(incidentId, conversationId);
  }
}
