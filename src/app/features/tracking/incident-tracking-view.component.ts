import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { IncidentMapComponent } from './incident-map.component';
import { WebSocketService } from '../../core/services/websocket.service';
import { ChatService } from '../../core/services/chat.service';
import { Message } from '../../core/models/chat.model';
import { CancellationService, CancellationRequest as CancellationRequestModel } from '../../core/services/cancellation.service';
import { AuthService } from '../../core/services/auth.service';
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
          <div class="chat-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Chat de seguimiento</span>
            @if (incident()?.es_ambiguo) {
              <span class="ambiguous-badge">Caso Ambiguo</span>
            }
          </div>
          <button class="close-button" (click)="toggleChat()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
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

        <!-- Ícono de cancelación discreto (disponible en todos los casos) -->
        @if (!pendingCancellation()) {
          <div class="cancel-request-icon-container">
            <button 
              class="cancel-request-icon" 
              (click)="showCancellationModal.set(true)"
              title="Solicitar cancelación del servicio"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            </button>
          </div>
        }

        <div class="chat-messages" #messagesContainer>
          @if (loadingMessages()) {
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
            @for (message of messages(); track message.id) {
              <div 
                class="message" 
                [class.own]="message.sender_id == currentUser()?.id"
                [class.system]="message.message_type === 'system'"
              >
                @if (message.message_type === 'system') {
                  <div class="system-message">
                    {{ message.message }}
                  </div>
                } @else {
                  <div class="message-bubble">
                    @if (message.sender_id != currentUser()?.id) {
                      <div class="sender-name">{{ message.sender_name || getSenderLabel(message.sender_role) }}</div>
                    }
                    <div class="message-text">{{ message.message }}</div>
                    <div class="message-time">
                      {{ formatTime(message.created_at) }}
                      @if (message.sender_id == currentUser()?.id) {
                        <span class="read-status">
                          {{ message.is_read ? '✓✓' : '✓' }}
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>

        <div class="chat-input">
          <textarea
            [(ngModel)]="newMessage"
            (keydown.enter)="onEnterPress($any($event))"
            placeholder="Escribe un mensaje..."
            rows="1"
            [disabled]="sendingMessage()"
          ></textarea>
          <button 
            class="send-button" 
            (click)="sendMessage()"
            [disabled]="!newMessage.trim() || sendingMessage()"
          >
            @if (sendingMessage()) {
              <div class="spinner-small"></div>
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            }
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
      padding: 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
    }

    .chat-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
    }

    .close-button {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: all 0.2s;
    }

    .close-button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Mensajes */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #f5f5f5;
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

    .empty-state svg {
      color: #ccc;
    }

    .empty-state p {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .empty-state span {
      font-size: 14px;
      color: #999;
    }

    .message {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 4px;
      animation: slideIn 0.3s ease-out;
    }

    .message.own {
      align-items: flex-end;
    }

    .message.system {
      align-items: center;
      margin: 8px 0;
    }

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
      background: #f0f0f0;
      padding: 8px 12px 6px;
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      max-width: 82%;
      min-width: 60px;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .message.own .message-bubble {
      background: #3b82f6;
      color: white;
      border-radius: 18px;
      border-bottom-right-radius: 4px;
    }

    .sender-name {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 2px;
      white-space: nowrap;
    }

    .message-text {
      font-size: 14px;
      line-height: 1.45;
      color: #1a1a1a;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.own .message-text {
      color: white;
    }

    .message-time {
      font-size: 10px;
      color: #999;
      margin-top: 3px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 3px;
    }

    .message.own .message-time {
      color: rgba(255, 255, 255, 0.75);
    }

    .read-status {
      font-size: 11px;
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

    .chat-input textarea:disabled {
      background: #f9fafb;
      cursor: not-allowed;
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

    /* Ambiguous case badge */
    .ambiguous-badge {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 8px;
      animation: pulse 2s infinite;
    }

    /* Ambiguous notice */
    .ambiguous-notice {
      background: linear-gradient(135deg, #fff7ed, #ffedd5);
      border: 1px solid #f59e0b;
      border-radius: 12px;
      padding: 16px;
      margin: 16px 20px;
      display: flex;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
    }

    .notice-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .notice-content h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #92400e;
    }

    .notice-content p {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: #78350f;
      line-height: 1.4;
    }

    .btn-cancel-request {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel-request:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
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

    /* Cancel request icon (discrete) */
    .cancel-request-icon-container {
      position: absolute;
      top: 16px;
      right: 60px; /* A la izquierda del botón de chat */
      z-index: 10;
    }

    .cancel-request-icon {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #ef4444;
    }

    .cancel-request-icon:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
    }

    .cancel-request-icon:active {
      transform: scale(0.95);
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

  // Cancellation properties
  showCancellationModal = signal(false);
  pendingCancellation = signal<CancellationRequest | null>(null);
  sendingCancellation = signal(false);
  respondingCancellation = signal(false);
  cancellationReason = '';

  newMessage = '';

  private wsSubscription?: Subscription;
  private incidentId?: number;

  ngOnInit(): void {
    // Obtener ID del incidente de la ruta
    this.route.params.subscribe(params => {
      this.incidentId = +params['id'];
      if (this.incidentId) {
        this.loadIncidentData();
        this.loadMessages();
        this.connectWebSocket();
        this.loadUnreadCount();
        this.loadPendingCancellation();
      }
    });
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    if (this.incidentId) {
      this.wsService.disconnect();
    }
  }

  private loadIncidentData(): void {
    if (!this.incidentId) return;

    // TODO: Cargar datos reales del incidente desde el servicio
    // Por ahora, usar el servicio de incidentes
    this.http.get<any>(`${environment.apiUrl}/incidentes/${this.incidentId}`).subscribe({
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

        // Si hay técnico asignado, cargar sus datos
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

        // Si hay taller asignado, usar los datos embebidos en la respuesta
        // o hacer una llamada separada si no están disponibles
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
    this.http.get<any>(`${environment.apiUrl}/users/workshops/${workshopId}`).subscribe({
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
      error: (error) => {
        console.error('Error loading workshop:', error);
      }
    });
  }

  private loadMessages(): void {
    if (!this.incidentId) return;

    this.loadingMessages.set(true);

    this.chatService.getMessages(this.incidentId).subscribe({
      next: (messages) => {
        // Ordenar mensajes por fecha (más antiguos primero)
        const sortedMessages = messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        this.messages.set(sortedMessages);
        this.loadingMessages.set(false);
        this.scrollToBottom();
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.loadingMessages.set(false);
      }
    });
  }

  private loadUnreadCount(): void {
    if (!this.incidentId) return;

    this.chatService.getUnreadCount(this.incidentId).subscribe({
      next: (response) => {
        this.unreadCount.set(response.unread_count);
      },
      error: (error) => {
        console.error('Error loading unread count:', error);
      }
    });
  }

  private connectWebSocket(): void {
    this.wsService.connect(this.incidentId!);

    this.wsSubscription = this.wsService.messages$.subscribe(message => {
      if (message.type === 'chat_message') {
        this.addMessage(message.data);
        if (!this.chatOpen()) {
          this.unreadCount.update(count => count + 1);
        }
      } else if (message.type === 'location_update') {
        this.updateTechnicianLocation(message.data);
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

  toggleChat(): void {
    this.chatOpen.update(open => !open);

    if (this.chatOpen()) {
      this.unreadCount.set(0);
      this.markMessagesAsRead();
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.newMessage.trim() || this.sendingMessage() || !this.incidentId) return;

    this.sendingMessage.set(true);

    try {
      const message = await this.chatService.sendMessage(this.incidentId, {
        message: this.newMessage.trim(),
        message_type: 'text'
      }).toPromise();

      if (message) {
        // Agregar nombre del remitente
        const enrichedMessage: Message = {
          ...message,
          sender_name: `${this.currentUser()?.first_name} ${this.currentUser()?.last_name}`
        };

        this.messages.update(msgs => [...msgs, enrichedMessage]);
        this.newMessage = '';
        this.scrollToBottom();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje. Por favor, intenta de nuevo.');
    } finally {
      this.sendingMessage.set(false);
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

    this.chatService.markMessagesAsRead(this.incidentId).subscribe({
      next: () => {
        this.messages.update(msgs =>
          msgs.map(msg => ({
            ...msg,
            is_read: Number(msg.sender_id) !== this.currentUser()?.id ? true : msg.is_read
          }))
        );
      },
      error: (error) => {
        console.error('Error marking messages as read:', error);
      }
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  goBack(): void {
    this.location.back();
  }

  private loadPendingCancellation(): void {
    if (!this.incidentId) return;

    this.cancellationService.getPendingCancellation(this.incidentId).subscribe({
      next: (cancellation) => {
        this.pendingCancellation.set(cancellation);
      },
      error: (error) => {
        if (error.status !== 404) {
          console.error('Error loading pending cancellation:', error);
        }
      }
    });
  }

  sendCancellationRequest(): void {
    if (!this.incidentId || !this.cancellationReason.trim() || this.sendingCancellation()) return;

    this.sendingCancellation.set(true);

    this.cancellationService.requestCancellation(this.incidentId, {
      reason: this.cancellationReason.trim()
    }).subscribe({
      next: (cancellation) => {
        this.pendingCancellation.set(cancellation);
        this.showCancellationModal.set(false);
        this.cancellationReason = '';
        this.sendingCancellation.set(false);

        // Enviar mensaje del sistema al chat
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
        alert('Error al enviar la solicitud de cancelación. Por favor, intenta de nuevo.');
        this.sendingCancellation.set(false);
      }
    });
  }

  respondToCancellation(accept: boolean): void {
    const cancellation = this.pendingCancellation();
    if (!cancellation || this.respondingCancellation()) return;

    this.respondingCancellation.set(true);

    const responseMessage = accept
      ? 'Acepto cancelar el servicio'
      : 'No acepto cancelar el servicio';

    this.cancellationService.respondToCancellation(cancellation.id, {
      accept: accept,
      response_message: responseMessage
    }).subscribe({
      next: (updatedCancellation) => {
        this.pendingCancellation.set(updatedCancellation);
        this.respondingCancellation.set(false);

        if (accept) {
          // Enviar mensaje del sistema
          this.addMessage({
            id: Date.now(),
            sender_id: this.currentUser()?.id || 0,
            message: `✅ Cancelación aceptada. El sistema buscará un nuevo taller automáticamente.`,
            message_type: 'system',
            created_at: new Date().toISOString()
          });

          // Mostrar animación de éxito y redirigir
          this.showSuccessAnimationAndRedirect();
        } else {
          // Enviar mensaje del sistema
          this.addMessage({
            id: Date.now(),
            sender_id: this.currentUser()?.id || 0,
            message: `❌ Cancelación rechazada. El servicio continúa normalmente.`,
            message_type: 'system',
            created_at: new Date().toISOString()
          });

          // Limpiar la solicitud después de un momento
          setTimeout(() => {
            this.pendingCancellation.set(null);
          }, 2000);
        }
      },
      error: (error) => {
        console.error('Error responding to cancellation:', error);
        alert('Error al responder la solicitud. Por favor, intenta de nuevo.');
        this.respondingCancellation.set(false);
      }
    });
  }

  private showSuccessAnimationAndRedirect(): void {
    // Crear overlay con animación
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in;
    `;

    const successBox = document.createElement('div');
    successBox.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      max-width: 400px;
      animation: scaleIn 0.4s ease-out;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    successBox.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 20px; animation: checkmark 0.6s ease-in-out;">✅</div>
      <h2 style="color: #10b981; margin: 0 0 12px 0; font-size: 24px; font-weight: 600;">Cancelación Aceptada</h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px;">El sistema buscará un nuevo taller automáticamente.</p>
      <p style="color: #9ca3af; margin: 16px 0 0 0; font-size: 14px;">Redirigiendo a solicitudes entrantes...</p>
    `;

    // Agregar estilos de animación
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes checkmark {
        0% { transform: scale(0) rotate(0deg); }
        50% { transform: scale(1.2) rotate(10deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
    `;
    document.head.appendChild(style);

    overlay.appendChild(successBox);
    document.body.appendChild(overlay);

    // Redirigir después de 2.5 segundos
    setTimeout(() => {
      overlay.style.animation = 'fadeOut 0.3s ease-out';
      overlay.style.opacity = '0';
      
      setTimeout(() => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
        
        // Redirigir según el tipo de usuario
        const userType = this.currentUser()?.user_type;
        if (userType === 'workshop') {
          this.router.navigate(['/workshop/incidents']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }, 300);
    }, 2500);
  }
}
