import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IncidentMapComponent } from './incident-map.component';
import { WebSocketService } from '../../core/services/websocket.service';
import { ChatService } from '../../core/services/chat.service';
import { Message } from '../../core/models/chat.model';
import { CancellationService, CancellationRequest as CancellationRequestModel } from '../../core/services/cancellation.service';
import { AuthService } from '../../core/services/auth.service';
import { TrackingRealtimeService } from '../../core/services/tracking-realtime.service';
import { environment } from '../../../environments/environment';

interface Incident {
  id: number;
  latitude: number;
  longitude: number;
  descripcion: string;
  estado_actual: string;
  tecnico_id?: number;
  taller_id?: number;
  client_id: number;
  es_ambiguo?: boolean;
}

interface CancellationRequest {
  id: number;
  incident_id: number;
  requested_by: string;
  requested_by_user_id: number;
  reason: string;
  status: string;
  response_by_user_id?: number;
  response_message?: string;
  responded_at?: string;
  created_at: string;
  expires_at: string;
}

interface Technician {
  id: number;
  first_name: string;
  last_name: string;
  current_latitude?: number;
  current_longitude?: number;
  is_online: boolean;
}

interface Workshop {
  id: number;
  workshop_name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

// Message ya está importado desde chat.model.ts y tiene sender_name

interface User {
  id: number;
  user_type: string;
  first_name: string;
  last_name: string;
}

@Component({
  selector: 'app-incident-tracking-view',
  standalone: true,
  imports: [CommonModule, FormsModule, IncidentMapComponent],
  template: `
    <div class="tracking-container">
      <!-- Botón de volver -->
      <button class="back-button" (click)="goBack()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Volver</span>
      </button>

      <!-- Mapa en pantalla completa -->
      <div class="map-section">
        @if (incident()) {
          <app-incident-map
            [incident]="incident()!"
            [technician]="technician()"
            [workshop]="workshop()"
            [showLegend]="true"
            [autoCenter]="true"
          />
        }
      </div>

      <!-- Botón flotante de chat -->
      <button 
        class="chat-toggle-button" 
        (click)="toggleChat()"
        [class.has-unread]="unreadCount() > 0"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        @if (unreadCount() > 0) {
          <span class="unread-badge">{{ unreadCount() }}</span>
        }
      </button>

      <!-- Panel de chat deslizable -->
      <div class="chat-panel" [class.open]="chatOpen()">
        <div class="chat-header">
          <div class="header-left">
            <button class="close-button" (click)="toggleChat()" title="Cerrar chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div class="header-info">
              <div class="chat-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Conversación</span>
              </div>
              @if (incident()?.es_ambiguo) {
                <span class="status-badge ambiguous">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  Caso Ambiguo
                </span>
              }
            </div>
          </div>
          <div class="header-actions">
            @if (!pendingCancellation()) {
              <button class="action-btn" (click)="showCancellationModal.set(true)" title="Solicitar cancelación">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
              </button>
            }
          </div>
        </div>

        @if (incident()?.es_ambiguo && !pendingCancellation()) {
          <div class="ambiguous-notice">
            <div class="notice-icon">⚠️</div>
            <div class="notice-content">
              <h4>Caso Ambiguo Detectado</h4>
              <p>Este caso requiere aclaración. Usa el chat para coordinar detalles, precio y alcance del servicio.</p>
              <button class="btn-cancel-request" (click)="showCancellationModal.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
                Solicitar Cancelación
              </button>
            </div>
          </div>
        }

        @if (pendingCancellation()) {
          <div class="cancellation-notice" [class.own-request]="pendingCancellation()!.requested_by === currentUser()?.user_type">
            <div class="notice-icon">🔔</div>
            <div class="notice-content">
              @if (pendingCancellation()!.requested_by === currentUser()?.user_type) {
                <h4>Solicitud de Cancelación Enviada</h4>
                <p>Esperando respuesta de {{ pendingCancellation()!.requested_by === 'client' ? 'el taller' : 'el cliente' }}</p>
                <div class="cancellation-reason">
                  <strong>Motivo:</strong> {{ pendingCancellation()!.reason }}
                </div>
              } @else {
                <h4>Solicitud de Cancelación Recibida</h4>
                <p>{{ pendingCancellation()!.requested_by === 'client' ? 'El cliente' : 'El taller' }} solicita cancelar el servicio</p>
                <div class="cancellation-reason">
                  <strong>Motivo:</strong> {{ pendingCancellation()!.reason }}
                </div>
                <div class="cancellation-actions">
                  <button class="btn-accept" (click)="respondToCancellation(true)" [disabled]="respondingCancellation()">
                    @if (respondingCancellation()) {
                      <div class="spinner-small"></div>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    }
                    Aceptar
                  </button>
                  <button class="btn-reject" (click)="respondToCancellation(false)" [disabled]="respondingCancellation()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Rechazar
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <div class="chat-messages" #messagesContainer (scroll)="onScroll($event)">
          @if (loadingMessages() && messages().length === 0) {
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Cargando mensajes...</p>
            </div>
          } @else if (messages().length === 0) {
            <div class="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p>No hay mensajes aún</p>
              <span>Inicia la conversación</span>
            </div>
          } @else {
            @for (item of messagesWithSeparators(); track item.key) {
              @if (item.type === 'separator') {
                <div class="day-separator">
                  <span>{{ item.label }}</span>
                </div>
              } @else {
                <div
                  class="message"
                  [class.own]="item.message!.sender_id == currentUser()?.id"
                  [class.system]="item.message!.message_type === 'system'"
                  [class.grouped]="item.isGrouped"
                >
                  @if (item.message!.message_type === 'system') {
                    <div class="system-message">{{ item.message!.message }}</div>
                  } @else {
                    <div class="message-bubble" [class.failed]="item.message!.status === 'failed'">
                      @if (item.message!.sender_id != currentUser()?.id && !item.isGrouped) {
                        <div class="sender-header">
                          <span class="sender-name">{{ item.message!.sender_name || getSenderLabel(item.message!.sender_role) }}</span>
                          <span class="sender-role-badge" [class]="'role-' + item.message!.sender_role">
                            {{ getRoleBadgeText(item.message!.sender_role) }}
                          </span>
                        </div>
                      }
                      <div class="message-text">{{ item.message!.message }}</div>
                      <div class="message-meta">
                        <span class="message-time">{{ formatMessageTime(item.message!.created_at) }}</span>
                        @if (item.message!.sender_id == currentUser()?.id) {
                          <span class="message-status" [class]="'status-' + (item.message!.status || (item.message!.is_read ? 'read' : 'sent'))">
                            @if (item.message!.status === 'sending') {
                              <span class="status-spinner"></span>
                            } @else if (item.message!.status === 'failed') {
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                            } @else if (item.message!.is_read || item.message!.status === 'read') {
                              <svg width="14" height="10" viewBox="0 0 24 16" fill="none" stroke="#34C759" stroke-width="2.5"><path d="M1 8l5 5L18 1M7 8l5 5L24 1"/></svg>
                            } @else {
                              <svg width="12" height="10" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.7"><path d="M1 6l4 4L15 1"/></svg>
                            }
                          </span>
                        }
                      </div>
                      @if (item.message!.status === 'failed') {
                        <button class="retry-btn" (click)="retryMessage(item.message!.localId!)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                          Reintentar
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            }
            @if (isTypingIndicatorVisible()) {
              <div class="typing-indicator">
                <div class="typing-bubble">
                  <span></span><span></span><span></span>
                </div>
              </div>
            }
          }
        </div>

        <!-- Botón flotante "bajar" -->
        @if (!isUserAtBottom() && newMessagesCount() > 0) {
          <button class="scroll-to-bottom-btn" (click)="scrollToBottomForced()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            @if (newMessagesCount() > 0) {
              <span class="new-count">{{ newMessagesCount() }}</span>
            }
          </button>
        }

        <!-- Indicador de conexión -->
        @if (wsConnectionStatus() !== 'connected') {
          <div class="connection-banner" [class.reconnecting]="wsConnectionStatus() === 'reconnecting'">
            @if (wsConnectionStatus() === 'reconnecting') {
              <span class="conn-spinner"></span>
              Reconectando...
            } @else {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
              Sin conexión
            }
          </div>
        }

        <div class="chat-input">
          <textarea
            [(ngModel)]="newMessage"
            (keydown.enter)="onEnterPress($any($event))"
            (input)="onInputChange()"
            (blur)="onInputBlur()"
            placeholder="Escribe un mensaje..."
            rows="1"
          ></textarea>
          <button
            class="send-button"
            (click)="sendMessage()"
            [disabled]="!newMessage.trim()"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Modal de solicitud de cancelación -->
      @if (showCancellationModal()) {
        <div class="modal-overlay" (click)="showCancellationModal.set(false)">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Solicitar Cancelación Mutua</h3>
              <button class="close-button" (click)="showCancellationModal.set(false)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-description">
                Esta solicitud será enviada a {{ currentUser()?.user_type === 'client' ? 'el taller' : 'el cliente' }}. 
                Si ambas partes están de acuerdo, el incidente se cancelará y se buscará un nuevo taller automáticamente.
              </p>
              <div class="form-group">
                <label for="cancellationReason">Motivo de la cancelación:</label>
                <textarea
                  id="cancellationReason"
                  [(ngModel)]="cancellationReason"
                  placeholder="Explica por qué solicitas cancelar el servicio..."
                  rows="4"
                  maxlength="500"
                  [disabled]="sendingCancellation()"
                ></textarea>
                <div class="char-count">{{ cancellationReason.length }}/500</div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="showCancellationModal.set(false)" [disabled]="sendingCancellation()">
                Cancelar
              </button>
              <button 
                class="btn-danger" 
                (click)="sendCancellationRequest()" 
                [disabled]="!cancellationReason.trim() || cancellationReason.trim().length < 10 || sendingCancellation()"
              >
                @if (sendingCancellation()) {
                  <div class="spinner-small"></div>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                  </svg>
                }
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .tracking-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #0a0a0a;
      z-index: 1000;
    }

    /* Botón de volver */
    .back-button {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 1001;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border: none;
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: #0a0a0a;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .back-button:hover {
      transform: translateX(-4px);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    }

    .back-button:active {
      transform: translateX(-2px) scale(0.98);
    }

    /* Mapa */
    .map-section {
      width: 100%;
      height: 100%;
    }

    /* Botón flotante de chat */
    .chat-toggle-button {
      position: absolute;
      bottom: 30px;
      right: 30px;
      z-index: 1001;
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
    }

    .chat-toggle-button:hover {
      transform: scale(1.1);
      box-shadow: 0 12px 48px rgba(59, 130, 246, 0.5);
    }

    .chat-toggle-button:active {
      transform: scale(0.95);
    }

    .chat-toggle-button.has-unread {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 12px;
      min-width: 20px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
    }

    /* Panel de chat */
    .chat-panel {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 400px;
      background: white;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 1002;
      display: flex;
      flex-direction: column;
    }

    .chat-panel.open {
      transform: translateX(0);
    }

    .chat-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(59, 130, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
      gap: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .header-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }

    .chat-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: white;
    }

    .chat-title svg {
      flex-shrink: 0;
      color: rgba(255, 255, 255, 0.9);
    }

    .chat-title span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      width: fit-content;
      letter-spacing: 0.02em;
    }

    .status-badge.ambiguous {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fbbf24;
    }

    .status-badge svg {
      flex-shrink: 0;
      color: #f59e0b;
    }

    .status-badge svg {
      flex-shrink: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .action-btn {
      width: 36px;
      height: 36px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: all 0.2s;
      flex-shrink: 0;
      backdrop-filter: blur(10px);
    }

    .action-btn:hover {
      background: rgba(239, 68, 68, 0.9);
      border-color: rgba(255, 255, 255, 0.5);
      color: white;
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .action-btn:active {
      transform: scale(0.95);
    }

    .close-button {
      width: 36px;
      height: 36px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: all 0.2s;
      flex-shrink: 0;
      backdrop-filter: blur(10px);
    }

    .close-button:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
      color: white;
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .close-button:active {
      transform: scale(0.95);
    }

    /* Mensajes */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: #f5f5f5;
      position: relative;
    }

    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
      text-align: center;
      gap: 12px;
    }

    .empty-state svg { color: #ccc; }
    .empty-state p { margin: 0; font-size: 16px; font-weight: 600; color: #333; }
    .empty-state span { font-size: 14px; color: #999; }

    /* Separadores de día */
    .day-separator {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 12px 0;
    }

    .day-separator span {
      background: rgba(0,0,0,0.08);
      color: #6b7280;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 12px;
    }

    /* Mensajes */
    .message {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 6px;
      animation: slideIn 0.25s ease-out;
    }

    .message.grouped { margin-bottom: 2px; }
    .message.own { align-items: flex-end; }
    .message.system { align-items: center; margin: 8px 0; }

    .system-message {
      background: rgba(59, 130, 246, 0.1);
      color: #2563eb;
      padding: 6px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-align: center;
      max-width: 90%;
    }

    .message-bubble {
      background: #ffffff;
      padding: 8px 12px 6px;
      border-radius: 18px 18px 18px 4px;
      max-width: 78%;
      min-width: 60px;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }

    .message.own .message-bubble {
      background: #3b82f6;
      color: white;
      border-radius: 18px 18px 4px 18px;
    }

    .message-bubble.failed {
      background: #fff5f5;
      border: 1px solid #fca5a5;
    }

    .message.own .message-bubble.failed {
      background: #7f1d1d;
      border: 1px solid #ef4444;
    }

    .sender-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }

    .sender-name {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      white-space: nowrap;
    }

    .sender-role-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sender-role-badge.role-client {
      background: rgba(59, 130, 246, 0.15);
      color: #1e40af;
    }

    .sender-role-badge.role-technician {
      background: rgba(16, 185, 129, 0.15);
      color: #065f46;
    }

    .sender-role-badge.role-workshop {
      background: rgba(245, 158, 11, 0.15);
      color: #92400e;
    }

    .message-text {
      font-size: 14px;
      line-height: 1.45;
      color: #1a1a1a;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.own .message-text { color: white; }

    .message-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 3px;
    }

    .message-time {
      font-size: 10px;
      color: #9ca3af;
    }

    .message.own .message-time { color: rgba(255,255,255,0.7); }

    .message-status { display: flex; align-items: center; }

    .status-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1.5px solid rgba(255,255,255,0.4);
      border-top-color: rgba(255,255,255,0.9);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .retry-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      color: #ef4444;
      font-size: 11px;
      cursor: pointer;
      padding: 4px 0 0;
      font-weight: 600;
    }

    /* Typing indicator */
    .typing-indicator {
      display: flex;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .typing-bubble {
      background: white;
      border-radius: 18px 18px 18px 4px;
      padding: 10px 14px;
      display: flex;
      gap: 4px;
      align-items: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }

    .typing-bubble span {
      width: 7px;
      height: 7px;
      background: #9ca3af;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
    .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    /* Botón scroll to bottom */
    .scroll-to-bottom-btn {
      position: absolute;
      bottom: 80px;
      right: 16px;
      width: 36px;
      height: 36px;
      background: white;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      color: #374151;
      transition: all 0.2s;
      z-index: 10;
    }

    .scroll-to-bottom-btn:hover { transform: scale(1.1); }

    .new-count {
      position: absolute;
      top: -6px;
      right: -6px;
      background: #ef4444;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 10px;
      min-width: 16px;
      text-align: center;
    }

    /* Banner de conexión */
    .connection-banner {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: #ef4444;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      z-index: 5;
    }

    .connection-banner.reconnecting { background: #f59e0b; }

    .conn-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* Input de chat */
    .chat-input {
      padding: 16px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      gap: 12px;
      align-items: flex-end;
      background: white;
    }

    .chat-input textarea {
      flex: 1;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      max-height: 120px;
      transition: border-color 0.2s;
    }

    .chat-input textarea:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .send-button {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border: none;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .send-button:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
    }

    .send-button:active:not(:disabled) {
      transform: scale(0.95);
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Spinners */
    .spinner,
    .spinner-small {
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner {
      width: 32px;
      height: 32px;
    }

    .spinner-small {
      width: 16px;
      height: 16px;
    }

    /* Animaciones */
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4);
      }
      50% {
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.8), 0 0 0 8px rgba(59, 130, 246, 0.2);
      }
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* Ambiguous notice — compacto y moderno */
    .ambiguous-notice {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 12px 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .notice-icon { 
      font-size: 20px; 
      flex-shrink: 0;
      line-height: 1;
    }

    .notice-content { 
      flex: 1; 
      min-width: 0; 
    }

    .notice-content h4 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 600;
      color: #92400e;
    }

    .notice-content p {
      margin: 0 0 10px 0;
      font-size: 12px;
      color: #78350f;
      line-height: 1.4;
    }

    .btn-cancel-request {
      background: #ef4444;
      color: white;
      border: none;
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .btn-cancel-request:hover {
      background: #dc2626;
    }

    /* Cancellation notice */
    .cancellation-notice {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 1px solid #f59e0b;
      border-radius: 12px;
      padding: 16px;
      margin: 16px 20px;
      display: flex;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
    }

    .cancellation-notice.own-request {
      background: linear-gradient(135deg, #dbeafe, #bfdbfe);
      border-color: #3b82f6;
    }

    .btn-cancel-request {
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-cancel-request:hover {
      background: #dc2626;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    }

    .btn-cancel-request:active {
      transform: translateY(0);
    }

    .cancellation-reason {
      background: rgba(0, 0, 0, 0.05);
      padding: 8px 12px;
      border-radius: 8px;
      margin: 8px 0;
      font-size: 12px;
      color: #374151;
    }

    .cancellation-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .btn-accept {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-accept:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .btn-reject {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-reject:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .btn-accept:disabled,
    .btn-reject:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.2s ease-out;
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow: hidden;
      animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #92400e;
    }

    .modal-body {
      padding: 24px;
    }

    .modal-description {
      margin: 0 0 20px 0;
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .form-group textarea {
      width: 100%;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
    }

    .form-group textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-group textarea:disabled {
      background: #f9fafb;
      cursor: not-allowed;
    }

    .char-count {
      text-align: right;
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn-secondary {
      background: white;
      color: #6b7280;
      border: 1px solid #d1d5db;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-danger:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }

    .btn-danger:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .back-button {
        top: 12px;
        left: 12px;
        padding: 10px 16px;
        font-size: 13px;
      }

      .chat-toggle-button {
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
      }

      .chat-panel {
        width: 100%;
      }
    }
  `]
})
export class IncidentTrackingViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly chatService = inject(ChatService);
  private readonly cancellationService = inject(CancellationService);
  private readonly authService = inject(AuthService);
  private readonly trackingRealtimeService = inject(TrackingRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('messagesContainer') messagesContainer?: ElementRef;

  incident = signal<Incident | null>(null);
  technician = signal<Technician | undefined>(undefined);
  workshop = signal<Workshop | undefined>(undefined);
  messages = signal<Message[]>([]);

  currentUser = computed<User | null>(() => {
    const user = this.authService.currentUser();
    if (!user) return null;
    return {
      id: user.id,
      user_type: user.user_type as string,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? ''
    };
  });

  chatOpen = signal(false);
  loadingMessages = signal(false);
  sendingMessage = signal(false);
  unreadCount = signal(0);
  error = signal<string | null>(null);

  // Cancellation
  showCancellationModal = signal(false);
  pendingCancellation = signal<CancellationRequest | null>(null);
  sendingCancellation = signal(false);
  respondingCancellation = signal(false);
  cancellationReason = '';

  newMessage = '';

  // ── Scroll inteligente ──────────────────────────────────────────────────
  isUserAtBottom = signal(true);
  newMessagesCount = signal(0);

  // ── Indicador de conexión ───────────────────────────────────────────────
  wsConnectionStatus = computed(() => this.wsService.connectionState());

  // ── Typing indicator ────────────────────────────────────────────────────
  isTypingIndicatorVisible = signal(false);
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;

  // ── markAsRead debounce ─────────────────────────────────────────────────
  private markAsReadTimer: ReturnType<typeof setTimeout> | null = null;
  private alreadyMarkedRead = false;

  // ── Mensajes con separadores de día ────────────────────────────────────
  messagesWithSeparators = computed(() => {
    const msgs = this.messages();
    const result: Array<{
      type: 'message' | 'separator';
      key: string;
      message?: Message;
      label?: string;
      isGrouped?: boolean;
    }> = [];

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = i > 0 ? msgs[i - 1] : null;

      // Separador de día
      if (!prev || !this.isSameDay(new Date(prev.created_at), new Date(msg.created_at))) {
        result.push({
          type: 'separator',
          key: `sep-${msg.created_at}`,
          label: this.formatDayLabel(new Date(msg.created_at))
        });
      }

      // Agrupación: mismo usuario, menos de 2 minutos de diferencia
      const isGrouped = !!prev &&
        prev.sender_id === msg.sender_id &&
        prev.message_type !== 'system' &&
        msg.message_type !== 'system' &&
        (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 120000;

      result.push({
        type: 'message',
        key: msg.localId ?? String(msg.id),
        message: msg,
        isGrouped
      });
    }

    return result;
  });

  private incidentId?: number;

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.incidentId = +params['id'];
        if (this.incidentId) {
          this.loadIncidentData();
          this.loadMessages();
          this.connectWebSocket();
          this.loadUnreadCount();
          this.loadPendingCancellation();
          this.subscribeToTrackingUpdates();
          this.subscribeToTypingIndicator();
          this.scheduleOldCacheCleanup();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.incidentId) {
      this.wsService.disconnect();
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.markAsReadTimer) clearTimeout(this.markAsReadTimer);
  }

  // ── Scroll ──────────────────────────────────────────────────────────────

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    this.isUserAtBottom.set(atBottom);
    if (atBottom) this.newMessagesCount.set(0);
  }

  scrollToBottomForced(): void {
    this.newMessagesCount.set(0);
    this.isUserAtBottom.set(true);
    this.scrollToBottom();
  }

  // ── Typing ──────────────────────────────────────────────────────────────

  onInputChange(): void {
    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      this.chatService.sendTypingStart(this.incidentId!);
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.stopTyping(), 3000);
  }

  onInputBlur(): void {
    this.stopTyping();
  }

  private stopTyping(): void {
    if (this.isCurrentlyTyping) {
      this.isCurrentlyTyping = false;
      this.chatService.sendTypingStop(this.incidentId!);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  private subscribeToTypingIndicator(): void {
    this.chatService.typingUsers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typingMap: Map<number, string[]>) => {
        const names = typingMap.get(this.incidentId!) ?? [];
        // Filtrar el usuario actual
        const othersTyping = names.filter(n => {
          const me = this.currentUser();
          return n !== `${me?.first_name} ${me?.last_name}`;
        });
        this.isTypingIndicatorVisible.set(othersTyping.length > 0);
        if (othersTyping.length > 0) this.scrollToBottom();
      });
  }

  // ── Cache cleanup ────────────────────────────────────────────────────────

  private scheduleOldCacheCleanup(): void {
    setTimeout(() => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('chat_'));
        const now = Date.now();
        let cleaned = 0;
        keys.forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.cachedAt && now - data.cachedAt > 30 * 24 * 60 * 60 * 1000) {
              localStorage.removeItem(key);
              cleaned++;
            }
          } catch { localStorage.removeItem(key); cleaned++; }
        });
        if (cleaned > 0) console.log(`[ChatCache] Cleaned ${cleaned} old entries`);
      } catch (e) { /* ignore */ }
    }, 5000);
  }

  // ── Helpers de fecha ─────────────────────────────────────────────────────

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  private formatDayLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (msgDay.getTime() === today.getTime()) return 'Hoy';
    if (msgDay.getTime() === yesterday.getTime()) return 'Ayer';
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
    if (diffDays < 7) {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatMessageTime(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  private loadIncidentData(): void {
    if (!this.incidentId) return;

    this.http.get<any>(`${environment.apiUrl}/incidentes/${this.incidentId}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const incidentData = response.data;
          this.incident.set({
            id: incidentData.id,
            latitude: incidentData.latitude,
            longitude: incidentData.longitude,
            descripcion: incidentData.descripcion,
            estado_actual: incidentData.estado_actual,
            tecnico_id: incidentData.tecnico_id,
            taller_id: incidentData.taller_id,
            client_id: incidentData.client_id,
            es_ambiguo: incidentData.es_ambiguo || false
          });

          if (incidentData.tecnico_id && incidentData.technician) {
            this.technician.set({
              id: incidentData.technician.id,
              first_name: incidentData.technician.first_name,
              last_name: incidentData.technician.last_name,
              current_latitude: incidentData.technician.current_latitude,
              current_longitude: incidentData.technician.current_longitude,
              is_online: incidentData.technician.is_online || true
            });
          }

          if (incidentData.workshop) {
            this.workshop.set({
              id: incidentData.workshop.id,
              workshop_name: incidentData.workshop.workshop_name,
              latitude: incidentData.workshop.latitude,
              longitude: incidentData.workshop.longitude,
              address: incidentData.workshop.address
            });
          } else if (incidentData.taller_id) {
            this.loadWorkshopData(incidentData.taller_id);
          }
        },
        error: (error) => {
          console.error('Error loading incident:', error);
          this.error.set('Error al cargar el incidente');
        }
      });
  }

  private loadWorkshopData(workshopId: number): void {
    this.http.get<any>(`${environment.apiUrl}/users/workshops/${workshopId}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const workshopData = response.data;
          this.workshop.set({
            id: workshopData.id,
            workshop_name: workshopData.workshop_name,
            latitude: workshopData.latitude,
            longitude: workshopData.longitude,
            address: workshopData.address
          });
        },
        error: (error) => console.error('Error loading workshop:', error)
      });
  }

  private loadMessages(): void {
    if (!this.incidentId) return;

    // 1. Cargar desde localStorage cache inmediatamente
    const cacheKey = `chat_${this.incidentId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.messages?.length) {
          this.messages.set(data.messages);
          this.loadingMessages.set(false);
          setTimeout(() => this.scrollToBottom(), 50);
        }
      }
    } catch { /* ignore */ }

    // 2. Suscribirse al observable del cache del servicio
    this.chatService.getMessagesObservable(this.incidentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (messages) => {
          const sorted = [...messages].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const prevLen = this.messages().length;
          this.messages.set(sorted);
          this.loadingMessages.set(false);

          // Guardar en localStorage
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ messages: sorted, cachedAt: Date.now() }));
          } catch { /* ignore */ }

          if (sorted.length > prevLen && prevLen > 0) {
            // Nuevos mensajes recibidos
            if (this.isUserAtBottom()) {
              this.scrollToBottom();
            } else {
              this.newMessagesCount.update(n => n + (sorted.length - prevLen));
            }
            // markAsRead con debounce
            this.scheduleMarkAsRead();
          } else if (prevLen === 0) {
            setTimeout(() => this.scrollToBottom(), 50);
          }
        },
        error: (error) => {
          console.error('Error loading messages:', error);
          this.loadingMessages.set(false);
        }
      });
  }

  private scheduleMarkAsRead(): void {
    if (this.alreadyMarkedRead) return;
    if (this.markAsReadTimer) clearTimeout(this.markAsReadTimer);
    this.markAsReadTimer = setTimeout(() => {
      this.markMessagesAsRead();
      this.alreadyMarkedRead = true;
      // Reset after 5 seconds to allow future marks
      setTimeout(() => { this.alreadyMarkedRead = false; }, 5000);
    }, 1000);
  }

  private loadUnreadCount(): void {
    if (!this.incidentId) return;
    this.chatService.getUnreadCount(this.incidentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.unreadCount.set(response.unread_count),
        error: (error) => console.error('Error loading unread count:', error)
      });
  }

  private connectWebSocket(): void {
    this.wsService.connect(this.incidentId!);

    this.wsService.messages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(message => {
        if (message.type === 'location_update') {
          this.updateTechnicianLocation(message.data);
        } else if (message.type === 'incident_status_changed' || message.type === 'incident_status_change') {
          const data = message.data ?? message;
          const incidentId = data?.incident_id;
          const newStatus = data?.estado_actual ?? data?.new_status;
          if (incidentId === this.incidentId && newStatus) {
            this.incident.update(inc => inc ? { ...inc, estado_actual: newStatus } : inc);
          }
        } else if (message.type === 'incident_cancelled') {
          const data = message.data ?? message;
          if (data?.incident_id === this.incidentId) {
            this.incident.update(inc => inc ? { ...inc, estado_actual: 'cancelado' } : inc);
          }
        } else if (message.type === 'technician_assigned') {
          const data = message.data ?? message;
          if (data?.incident_id === this.incidentId) {
            this.loadIncidentData();
          }
        }
      });
  }

  private addMessage(messageData: any): void {
    const newMsg: Message = {
      id: messageData.id || Date.now(),
      incident_id: this.incidentId!,
      sender_id: Number(messageData.sender_id),
      message: messageData.message,
      message_type: messageData.message_type || 'text',
      is_read: false,
      created_at: messageData.created_at || new Date().toISOString(),
      sender_name: messageData.sender_name
    };
    this.messages.update(msgs => [...msgs, newMsg]);
    this.scrollToBottom();
  }

  private updateTechnicianLocation(data: any): void {
    if (this.technician()) {
      this.technician.update(tech => ({
        ...tech!,
        current_latitude: data.latitude,
        current_longitude: data.longitude
      }));
    }
  }

  private subscribeToTrackingUpdates(): void {
    if (!this.incidentId) return;

    this.trackingRealtimeService.locationUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(location => {
        if (location.incidentId === this.incidentId) {
          this.technician.update(tech => {
            if (!tech) return tech;
            return { ...tech, current_latitude: location.latitude, current_longitude: location.longitude };
          });
        }
      });

    this.trackingRealtimeService.routeUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(routeUpdate => {
        if (routeUpdate.incidentId === this.incidentId) {
          console.log('🗺️ Route updated - ETA:', routeUpdate.estimatedArrival);
        }
      });

    this.trackingRealtimeService.sessionUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(session => {
        if (session.incidentId === this.incidentId) {
          console.log('🚀 Tracking session update:', session.status);
        }
      });
  }

  toggleChat(): void {
    this.chatOpen.update(open => !open);
    if (this.chatOpen()) {
      this.unreadCount.set(0);
      this.newMessagesCount.set(0);
      this.scheduleMarkAsRead();
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async sendMessage(): Promise<void> {
    const text = this.newMessage.trim();
    if (!text || !this.incidentId) return;

    // Stop typing
    this.stopTyping();

    // 1. Crear mensaje temporal (envío optimista)
    const localId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage: Message = {
      id: Date.now(),
      incident_id: this.incidentId,
      sender_id: this.currentUser()?.id ?? 0,
      sender_name: `${this.currentUser()?.first_name} ${this.currentUser()?.last_name}`,
      message: text,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
      localId,
      status: 'sending',
      isTemporary: true
    };

    // 2. Agregar inmediatamente
    this.messages.update(msgs => [...msgs, tempMessage]);
    this.newMessage = '';
    this.scrollToBottom();

    // 3. Enviar al backend
    try {
      const message = await this.chatService.sendMessage(this.incidentId, {
        message: text,
        message_type: 'text'
      }).toPromise();

      if (message) {
        const enriched: Message = {
          ...message,
          sender_name: `${this.currentUser()?.first_name} ${this.currentUser()?.last_name}`,
          status: 'sent'
        };
        // Reemplazar temporal con real
        this.messages.update(msgs =>
          msgs.map(m => m.localId === localId ? enriched : m)
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Marcar como fallido
      this.messages.update(msgs =>
        msgs.map(m => m.localId === localId
          ? { ...m, status: 'failed' as const, errorMessage: 'Error al enviar' }
          : m
        )
      );
    }
  }

  async retryMessage(localId: string): Promise<void> {
    const msg = this.messages().find(m => m.localId === localId);
    if (!msg || !this.incidentId) return;

    // Cambiar a enviando
    this.messages.update(msgs =>
      msgs.map(m => m.localId === localId ? { ...m, status: 'sending' as const, errorMessage: undefined } : m)
    );

    try {
      const sent = await this.chatService.sendMessage(this.incidentId, {
        message: msg.message,
        message_type: 'text'
      }).toPromise();

      if (sent) {
        this.messages.update(msgs =>
          msgs.map(m => m.localId === localId ? { ...sent, status: 'sent' as const } : m)
        );
      }
    } catch {
      this.messages.update(msgs =>
        msgs.map(m => m.localId === localId ? { ...m, status: 'failed' as const } : m)
      );
    }
  }

  onEnterPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private markMessagesAsRead(): void {
    if (!this.incidentId) return;
    this.chatService.markMessagesAsRead(this.incidentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update(msgs =>
            msgs.map(msg => ({
              ...msg,
              is_read: Number(msg.sender_id) !== this.currentUser()?.id ? true : msg.is_read
            }))
          );
        },
        error: (error) => console.error('Error marking as read:', error)
      });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
  }

  getSenderLabel(role?: string): string {
    switch (role) {
      case 'client': return 'Cliente';
      case 'workshop': return 'Taller';
      case 'technician': return 'Técnico';
      case 'administrator':
      case 'admin': return 'Admin';
      default: return 'Usuario';
    }
  }

  getRoleBadgeText(role?: string): string {
    switch (role) {
      case 'client': return 'Cliente';
      case 'workshop': return 'Taller';
      case 'technician': return 'Técnico';
      case 'administrator':
      case 'admin': return 'Admin';
      default: return '';
    }
  }

  goBack(): void {
    this.location.back();
  }

  private loadPendingCancellation(): void {
    if (!this.incidentId) return;
    this.cancellationService.getPendingCancellation(this.incidentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cancellation) => this.pendingCancellation.set(cancellation),
        error: (error) => {
          if (error.status !== 404) console.error('Error loading pending cancellation:', error);
        }
      });
  }

  sendCancellationRequest(): void {
    if (!this.incidentId || !this.cancellationReason.trim() || this.sendingCancellation()) return;
    this.sendingCancellation.set(true);

    this.cancellationService.requestCancellation(this.incidentId, { reason: this.cancellationReason.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cancellation) => {
          this.pendingCancellation.set(cancellation);
          this.showCancellationModal.set(false);
          this.cancellationReason = '';
          this.sendingCancellation.set(false);
          this.addMessage({
            id: Date.now(),
            sender_id: this.currentUser()?.id || 0,
            message: `📋 Solicitud de cancelación enviada: ${cancellation.reason}`,
            message_type: 'system',
            created_at: new Date().toISOString()
          });
        },
        error: (error) => {
          console.error('Error sending cancellation request:', error);
          alert('Error al enviar la solicitud de cancelación.');
          this.sendingCancellation.set(false);
        }
      });
  }

  respondToCancellation(accept: boolean): void {
    const cancellation = this.pendingCancellation();
    if (!cancellation || this.respondingCancellation()) return;
    this.respondingCancellation.set(true);

    this.cancellationService.respondToCancellation(cancellation.id, {
      accept,
      response_message: accept ? 'Acepto cancelar el servicio' : 'No acepto cancelar el servicio'
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedCancellation) => {
          this.pendingCancellation.set(updatedCancellation);
          this.respondingCancellation.set(false);
          if (accept) {
            this.addMessage({
              id: Date.now(),
              sender_id: this.currentUser()?.id || 0,
              message: `✅ Cancelación aceptada. El sistema buscará un nuevo taller automáticamente.`,
              message_type: 'system',
              created_at: new Date().toISOString()
            });
            this.showSuccessAnimationAndRedirect();
          } else {
            this.addMessage({
              id: Date.now(),
              sender_id: this.currentUser()?.id || 0,
              message: `❌ Cancelación rechazada. El servicio continúa normalmente.`,
              message_type: 'system',
              created_at: new Date().toISOString()
            });
            setTimeout(() => this.pendingCancellation.set(null), 2000);
          }
        },
        error: (error) => {
          console.error('Error responding to cancellation:', error);
          alert('Error al responder la solicitud.');
          this.respondingCancellation.set(false);
        }
      });
  }

  private showSuccessAnimationAndRedirect(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;`;
    const box = document.createElement('div');
    box.style.cssText = `background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3);`;
    box.innerHTML = `<div style="font-size:64px;margin-bottom:20px;">✅</div><h2 style="color:#10b981;margin:0 0 12px 0;font-size:24px;font-weight:600;">Cancelación Aceptada</h2><p style="color:#6b7280;margin:0;font-size:16px;">El sistema buscará un nuevo taller automáticamente.</p>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(() => {
      document.body.removeChild(overlay);
      const userType = this.currentUser()?.user_type;
      this.router.navigate([userType === 'workshop' ? '/workshop/incidents' : '/dashboard']);
    }, 2500);
  }
}

