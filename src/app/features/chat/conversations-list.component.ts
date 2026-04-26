import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../core/services/chat.service';
import { Conversation } from '../../core/models/chat.model';

@Component({
  selector: 'app-conversations-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="conversations-container">
      <div class="conversations-header">
        <h2>Conversaciones</h2>
        <button class="btn-refresh" (click)="loadConversations()" title="Actualizar">
          <i class="icon-refresh"></i>
        </button>
      </div>

      <div *ngIf="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Cargando conversaciones...</p>
      </div>

      <div *ngIf="!isLoading && conversations.length === 0" class="empty-state">
        <i class="icon-chat-empty"></i>
        <h3>No hay conversaciones</h3>
        <p>Las conversaciones aparecerán aquí cuando tengas incidentes activos</p>
      </div>

      <div *ngIf="!isLoading && conversations.length > 0" class="conversations-list">
        <div *ngFor="let conversation of conversations" 
             class="conversation-item"
             [class.unread]="conversation.unread_count > 0"
             (click)="selectConversation(conversation)">
          
          <div class="conversation-avatar">
            <div class="avatar-circle">
              {{ getInitials(conversation.client_name || conversation.workshop_name) }}
            </div>
            <span *ngIf="conversation.unread_count > 0" class="unread-badge">
              {{ conversation.unread_count }}
            </span>
          </div>

          <div class="conversation-content">
            <div class="conversation-header">
              <h4 class="conversation-name">
                {{ conversation.client_name || conversation.workshop_name || 'Usuario' }}
              </h4>
              <span class="conversation-time">
                {{ formatTime(conversation.last_message_at) }}
              </span>
            </div>
            <div class="conversation-preview">
              <p class="last-message">
                {{ conversation.last_message || 'Sin mensajes' }}
              </p>
            </div>
            <div class="conversation-meta">
              <span class="incident-id">Incidente #{{ conversation.incident_id }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .conversations-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .conversations-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .conversations-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .btn-refresh {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-refresh:hover {
      background: rgba(0,0,0,0.05);
    }

    .loading, .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #666;
      padding: 32px;
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #2196f3;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .empty-state i {
      font-size: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }

    .conversations-list {
      flex: 1;
      overflow-y: auto;
    }

    .conversation-item {
      display: flex;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: background 0.2s;
    }

    .conversation-item:hover {
      background: #f8f9fa;
    }

    .conversation-item.unread {
      background: #e3f2fd;
    }

    .conversation-item.unread:hover {
      background: #bbdefb;
    }

    .conversation-avatar {
      position: relative;
      flex-shrink: 0;
    }

    .avatar-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 18px;
    }

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #f44336;
      color: white;
      border-radius: 12px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 600;
      min-width: 20px;
      text-align: center;
    }

    .conversation-content {
      flex: 1;
      min-width: 0;
    }

    .conversation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .conversation-name {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .conversation-time {
      font-size: 12px;
      color: #999;
      flex-shrink: 0;
      margin-left: 8px;
    }

    .conversation-preview {
      margin-bottom: 4px;
    }

    .last-message {
      margin: 0;
      font-size: 14px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .conversation-item.unread .last-message {
      font-weight: 600;
      color: #333;
    }

    .conversation-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .incident-id {
      font-size: 12px;
      color: #999;
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 12px;
    }
  `]
})
export class ConversationsListComponent implements OnInit {
  @Output() conversationSelected = new EventEmitter<Conversation>();

  conversations: Conversation[] = [];
  isLoading: boolean = true;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.loadConversations();
  }

  loadConversations(): void {
    this.isLoading = true;
    this.chatService.getUserConversations().subscribe({
      next: (conversations: any[]) => {
        this.conversations = conversations.sort((a: any, b: any) => {
          const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return dateB - dateA;
        });
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading conversations:', error);
        this.isLoading = false;
      }
    });
  }

  selectConversation(conversation: Conversation): void {
    this.conversationSelected.emit(conversation);
  }

  getInitials(name?: string): string {
    if (!name) return 'U';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatTime(dateString?: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  }
}
