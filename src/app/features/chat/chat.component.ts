import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Message } from '../../core/models/chat.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="header-info">
          <h3>{{ otherPartyName }}</h3>
          <span class="status" [class.online]="isOnline">
            {{ isOnline ? 'En línea' : 'Desconectado' }}
          </span>
        </div>
        <div class="header-actions">
          <button class="btn-icon" (click)="refreshMessages()" title="Actualizar">
            <i class="icon-refresh"></i>
          </button>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="messages-container" #messagesContainer>
        <div *ngIf="isLoading" class="loading">
          <div class="spinner"></div>
          <p>Cargando mensajes...</p>
        </div>

        <div *ngIf="!isLoading && messages.length === 0" class="empty-state">
          <i class="icon-chat-empty"></i>
          <h4>No hay mensajes aún</h4>
          <p>Envía un mensaje para iniciar la conversación</p>
        </div>

        <div *ngIf="!isLoading && messages.length > 0" class="messages-list">
          <div *ngFor="let message of messages" 
               class="message-wrapper"
               [class.message-me]="message.sender_id === currentUserId"
               [class.message-other]="message.sender_id !== currentUserId">
            
            <div class="message-bubble">
              <div *ngIf="message.sender_id !== currentUserId" class="message-sender">
                {{ message.sender_name }}
              </div>
              <div class="message-text">{{ message.message }}</div>
              <div class="message-meta">
                <span class="message-time">{{ formatTime(message.created_at) }}</span>
                <span *ngIf="message.sender_id === currentUserId" class="message-status">
                  <i [class]="message.is_read ? 'icon-check-double' : 'icon-check'"></i>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="isTyping" class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input">
        <div class="input-wrapper">
          <button class="btn-emoji" (click)="toggleEmojiPicker()" title="Emojis">
            😊
          </button>
          <input 
            type="text" 
            [(ngModel)]="messageText"
            (keyup.enter)="sendMessage()"
            (keyup)="onInputKeyup()"
            (blur)="onInputBlur()"
            [disabled]="isSending"
            placeholder="Escribe un mensaje..."
            class="message-input"
          />
          <button 
            class="btn-send" 
            (click)="sendMessage()"
            [disabled]="!messageText.trim() || isSending"
            title="Enviar">
            <i class="icon-send"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .header-info h3 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 600;
    }

    .status {
      font-size: 12px;
      color: #666;
    }

    .status.online {
      color: #4caf50;
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: rgba(0,0,0,0.05);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f5f5f5;
    }

    .loading, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #2196f3;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .message-wrapper {
      display: flex;
      margin-bottom: 8px;
    }

    .message-wrapper.message-me {
      justify-content: flex-end;
    }

    .message-wrapper.message-other {
      justify-content: flex-start;
    }

    .message-bubble {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 16px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .message-me .message-bubble {
      background: #2196f3;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message-other .message-bubble {
      background: white;
      color: #333;
      border-bottom-left-radius: 4px;
    }

    .message-sender {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #666;
    }

    .message-text {
      font-size: 15px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 11px;
      opacity: 0.8;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: white;
      border-radius: 16px;
      width: fit-content;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #999;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-10px); }
    }

    .chat-input {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
      background: white;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f5f5f5;
      border-radius: 24px;
      padding: 8px 12px;
    }

    .btn-emoji {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }

    .message-input {
      flex: 1;
      border: none;
      background: none;
      outline: none;
      font-size: 15px;
      padding: 8px;
    }

    .btn-send {
      background: #2196f3;
      border: none;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .btn-send:hover:not(:disabled) {
      background: #1976d2;
    }

    .btn-send:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() incidentId!: number;
  @Input() currentUserId!: number;
  @Input() otherPartyName: string = 'Usuario';
  
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: Message[] = [];
  messageText: string = '';
  isLoading: boolean = true;
  isSending: boolean = false;
  isTyping: boolean = false;
  isOnline: boolean = false;
  
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom: boolean = false;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping: boolean = false;

  constructor(
    private chatService: ChatService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.loadMessages();
    this.connectWebSocket();
    this.subscribeToMessages();
    this.subscribeToTypingUsers();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.wsService.leaveIncidentRoom(this.incidentId);
    // Ensure typing stop is sent when component is destroyed
    if (this.isCurrentlyTyping) {
      this.chatService.sendTypingStop(this.incidentId);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  loadMessages(): void {
    this.isLoading = true;
    this.chatService.getMessages(this.incidentId).subscribe({
      next: (messages: Message[]) => {
        this.messages = messages;
        this.isLoading = false;
        this.shouldScrollToBottom = true;
        this.markAsRead();
      },
      error: (error: any) => {
        console.error('Error loading messages:', error);
        this.isLoading = false;
      }
    });
  }

  refreshMessages(): void {
    this.loadMessages();
  }

  connectWebSocket(): void {
    // Conectar al WebSocket si no está conectado
    if (!this.wsService.isConnected()) {
      this.wsService.connect(this.incidentId);
    }
    
    // Unirse al room del incidente
    this.wsService.joinIncidentRoom(this.incidentId);
  }

  subscribeToMessages(): void {
    // Suscribirse a mensajes nuevos del servicio de chat
    const sub = this.chatService.newMessage$.subscribe((message: Message) => {
      if (message.incident_id === this.incidentId) {
        // Evitar duplicados
        if (!this.messages.find(m => m.id === message.id)) {
          this.messages.push(message);
          this.shouldScrollToBottom = true;
          
          // Marcar como leído si no es del usuario actual
          if (message.sender_id !== this.currentUserId) {
            this.markAsRead();
          }
        }
      }
    });
    this.subscriptions.push(sub);
  }

  /**
   * Subscribe to typing users observable and update isTyping flag
   */
  subscribeToTypingUsers(): void {
    const sub = this.chatService.typingUsers$.subscribe((typingMap: Map<number, string[]>) => {
      const names = typingMap.get(this.incidentId) ?? [];
      this.isTyping = names.length > 0;
    });
    this.subscriptions.push(sub);
  }

  /**
   * Called on every keyup in the message input (except Enter which sends)
   */
  onInputKeyup(): void {
    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      this.chatService.sendTypingStart(this.incidentId);
    }

    // Reset the inactivity timer (3 seconds)
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 3000);
  }

  /**
   * Called when the input loses focus
   */
  onInputBlur(): void {
    this.stopTyping();
  }

  private stopTyping(): void {
    if (this.isCurrentlyTyping) {
      this.isCurrentlyTyping = false;
      this.chatService.sendTypingStop(this.incidentId);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  sendMessage(): void {
    if (!this.messageText.trim() || this.isSending) return;

    this.isSending = true;
    const text = this.messageText.trim();
    this.messageText = '';

    // Stop typing indicator when message is sent
    this.stopTyping();

    this.chatService.sendMessage(this.incidentId, { message: text }).subscribe({
      next: (message: Message) => {
        this.messages.push(message);
        this.isSending = false;
        this.shouldScrollToBottom = true;
      },
      error: (error: any) => {
        console.error('Error sending message:', error);
        this.messageText = text; // Restore message
        this.isSending = false;
      }
    });
  }

  markAsRead(): void {
    this.chatService.markMessagesAsRead(this.incidentId).subscribe({
      error: (error: any) => console.error('Error marking as read:', error)
    });
  }

  scrollToBottom(): void {
    try {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return `Ayer ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }

  toggleEmojiPicker(): void {
    // TODO: Implement emoji picker
    console.log('Emoji picker not implemented yet');
  }
}
