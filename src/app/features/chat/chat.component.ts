import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, DestroyRef, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../core/services/chat.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Message } from '../../core/models/chat.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule],
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

      <!-- Messages Area with Virtual Scroll -->
      <div class="messages-container">
        <div *ngIf="isLoading" class="loading">
          <div class="spinner"></div>
          <p>Cargando mensajes...</p>
        </div>

        <div *ngIf="!isLoading && messages.length === 0" class="empty-state">
          <i class="icon-chat-empty"></i>
          <h4>No hay mensajes aún</h4>
          <p>Envía un mensaje para iniciar la conversación</p>
        </div>

        <!-- Virtual Scroll Viewport for Messages -->
        <cdk-virtual-scroll-viewport 
          *ngIf="!isLoading && messages.length > 0"
          [itemSize]="messageItemSize()"
          class="messages-viewport"
          #viewport>
          
          <div *cdkVirtualFor="let message of messages; trackBy: trackByMessageId" 
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

          <!-- Typing Indicator (outside virtual scroll) -->
          <div *ngIf="isTyping" class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </cdk-virtual-scroll-viewport>
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
      overflow: hidden;
      background: #f5f5f5;
      position: relative;
    }

    /* Virtual Scroll Viewport Styles */
    .messages-viewport {
      height: 100%;
      width: 100%;
    }

    .messages-viewport .cdk-virtual-scroll-content-wrapper {
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 8px;
    }

    .loading, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
      padding: 16px;
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

    .message-wrapper {
      display: flex;
      margin-bottom: 8px;
      min-height: 60px; /* Minimum height for virtual scroll item size calculation */
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
      margin: 8px 16px;
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

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .message-wrapper {
        min-height: 50px;
      }

      .message-bubble {
        max-width: 85%;
        padding: 10px 14px;
      }

      .message-text {
        font-size: 14px;
      }
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly destroyRef = inject(DestroyRef);
  private readonly chatService = inject(ChatService);
  private readonly wsService = inject(WebSocketService);

  @Input() incidentId!: number;
  @Input() currentUserId!: number;
  @Input() otherPartyName = 'Usuario';
  
  @ViewChild('viewport') viewport!: CdkVirtualScrollViewport;

  messages: Message[] = [];
  messageText = '';
  isLoading = true;
  isSending = false;
  isTyping = false;
  isOnline = false;
  
  private shouldScrollToBottom = false;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;

  // Computed signal for responsive message item size
  readonly messageItemSize = computed(() => {
    // Base size for messages, adjust based on screen size
    return window.innerWidth <= 768 ? 50 : 60;
  });

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
    // El observable del cache se encarga de cargar los mensajes automáticamente
    // Solo necesitamos indicar que estamos cargando inicialmente
    this.isLoading = true;
    
    // Esperar un momento para que el cache cargue los mensajes
    setTimeout(() => {
      this.isLoading = false;
      this.shouldScrollToBottom = true;
      this.markAsRead();
    }, 500);
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
    // Suscribirse al observable de mensajes del cache (se actualiza automáticamente)
    this.chatService.getMessagesObservable(this.incidentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((messages: Message[]) => {
        console.log(`📬 Chat component received ${messages.length} messages from cache for incident ${this.incidentId}`);
        const previousLength = this.messages.length;
        this.messages = messages;
        
        // Si hay nuevos mensajes, hacer scroll y marcar como leído
        if (messages.length > previousLength) {
          console.log(`✨ New messages detected: ${previousLength} -> ${messages.length}`);
          this.shouldScrollToBottom = true;
          
          // Marcar como leído si el último mensaje no es del usuario actual
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.sender_id !== this.currentUserId) {
            this.markAsRead();
          }
        }
      });
  }

  /**
   * Subscribe to typing users observable and update isTyping flag
   */
  subscribeToTypingUsers(): void {
    this.chatService.typingUsers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typingMap: Map<number, string[]>) => {
        const names = typingMap.get(this.incidentId) ?? [];
        this.isTyping = names.length > 0;
      });
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
      if (this.viewport) {
        // Scroll to the end of the virtual scroll viewport
        const scrollIndex = this.messages.length - 1;
        if (scrollIndex >= 0) {
          this.viewport.scrollToIndex(scrollIndex, 'smooth');
        }
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  /**
   * TrackBy function for virtual scrolling performance optimization
   */
  trackByMessageId(index: number, message: Message): number {
    return message.id;
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
