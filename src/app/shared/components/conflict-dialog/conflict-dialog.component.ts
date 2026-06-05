import { Component, EventEmitter, Input, Output, signal, effect } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { DecimalPipe } from '@angular/common';

export interface ConflictItem {
  client_operation_id: string;
  operation_type: string;
  conflict_code: string;
  message: string;
  server_state?: Record<string, unknown>;
  alternatives?: { workshop_id: number; name: string; distance_km: number; score?: number }[];
}

@Component({
  selector: 'app-conflict-dialog',
  standalone: true,
  imports: [DecimalPipe],
  animations: [
    trigger('overlayFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.2s ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('0.15s ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('modalSlide', [
      transition(':enter', [
        style({ transform: 'scale(0.95) translateY(20px)', opacity: 0 }),
        animate('0.25s ease-out', style({ transform: 'scale(1) translateY(0)', opacity: 1 })),
      ]),
    ]),
  ],
  template: `
    @if (visible()) {
      <div class="conflict-overlay" [@overlayFade] (click)="dismiss.emit()">
        <div class="conflict-modal" [@modalSlide] (click)="$event.stopPropagation()">
          <div class="conflict-header">
            <span class="conflict-icon">&#x26A1;</span>
            <div>
              <h3 class="conflict-title">{{ conflicts.length }} conflicto(s) detectado(s)</h3>
              <p class="conflict-sub">
                Algunas operaciones no pudieron completarse mientras estabas sin conexion.
              </p>
            </div>
          </div>

          <div class="conflict-list">
            @for (c of conflicts; track c.client_operation_id; let i = $index) {
              <div class="conflict-card" [style.animation-delay.ms]="i * 60">
                <div class="card-header">
                  <span class="card-badge">{{ formatType(c.operation_type) }}</span>
                  <span class="card-code">{{ c.conflict_code }}</span>
                </div>
                <p class="card-msg">{{ c.message }}</p>

                @if (c.server_state) {
                  <div class="card-state">
                    <strong>Estado actual del servidor:</strong>
                    <code>{{ formatState(c.server_state) }}</code>
                  </div>
                }

                @if (c.alternatives?.length) {
                  <div class="card-alts">
                    <strong>Talleres alternativos disponibles:</strong>
                    @for (alt of c.alternatives; track alt.workshop_id) {
                      <button class="alt-chip"
                              (click)="selectAlternative.emit({
                                client_operation_id: c.client_operation_id,
                                workshop_id: alt.workshop_id
                              })">
                        <span class="alt-name">{{ alt.name }}</span>
                        <span class="alt-dist">{{ alt.distance_km | number:'1.1-1' }} km</span>
                        @if (alt.score) {
                          <span class="alt-score">{{ (alt.score * 100) | number:'1.0-0' }}%</span>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <div class="conflict-footer">
            <button class="btn-primary" (click)="dismiss.emit()">
              Entendido, refrescar datos
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .conflict-overlay {
      position: fixed; inset: 0; z-index: 20000;
      background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center;
    }
    .conflict-modal {
      background: #fff; border-radius: 16px; width: 520px; max-width: 94vw;
      max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    .conflict-header {
      display: flex; gap: 14px; padding: 24px 24px 16px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
    }
    .conflict-icon { font-size: 32px; flex-shrink: 0; }
    .conflict-title { margin: 0 0 4px; font-size: 18px; color: #92400e; }
    .conflict-sub { margin: 0; font-size: 13px; color: #a16207; }

    .conflict-list { flex: 1; overflow-y: auto; padding: 8px 24px 16px; }

    .conflict-card {
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
      padding: 14px; margin-top: 10px;
      animation: cardIn 0.3s ease-out both;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .card-header { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .card-badge {
      background: #f59e0b; color: #fff; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600;
    }
    .card-code {
      font-size: 10px; font-family: monospace; color: #92400e;
      background: #fef3c7; padding: 2px 6px; border-radius: 3px;
    }
    .card-msg { margin: 0 0 8px; font-size: 13px; color: #78350f; line-height: 1.5; }
    .card-state { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .card-state code { font-size: 11px; color: #374151; }

    .card-alts { margin-top: 6px; }
    .card-alts strong { font-size: 12px; color: #374151; display: block; margin-bottom: 6px; }

    .alt-chip {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 10px 12px; margin-bottom: 4px;
      background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
      cursor: pointer; font-size: 13px; transition: all 0.15s;
      text-align: left;
    }
    .alt-chip:hover { background: #f9fafb; border-color: #f59e0b; }
    .alt-name { flex: 1; font-weight: 500; }
    .alt-dist { color: #6b7280; font-size: 12px; }
    .alt-score {
      background: #ecfdf5; color: #065f46; padding: 2px 6px;
      border-radius: 4px; font-size: 11px; font-weight: 600;
    }

    .conflict-footer { padding: 16px 24px; border-top: 1px solid #e5e7eb; }
    .btn-primary {
      width: 100%; padding: 12px; background: #f59e0b; color: #fff;
      border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #d97706; }
  `],
})
export class ConflictDialogComponent {
  @Input() conflicts: ConflictItem[] = [];
  @Output() dismiss = new EventEmitter<void>();
  @Output() selectAlternative = new EventEmitter<{
    client_operation_id: string;
    workshop_id: number;
  }>();

  readonly visible = signal(false);

  constructor() {
    effect(() => { if (this.conflicts.length > 0) this.visible.set(true); });
  }

  formatType(type: string): string {
    const map: Record<string, string> = {
      CREATE_INCIDENT: 'Nuevo incidente',
      UPDATE_INCIDENT_STATUS: 'Cambio de estado',
      UPDATE_INCIDENT: 'Actualizar incidente',
      SEND_CHAT_MESSAGE: 'Mensaje',
      UPDATE_LOCATION: 'Ubicacion',
      ASSIGN_TECHNICIAN: 'Asignar tecnico',
      MARK_ARRIVED: 'Llegada',
      UPLOAD_EVIDENCE: 'Evidencia',
      SELECT_WORKSHOP: 'Seleccion de taller',
      CREATE_VEHICLE: 'Nuevo vehiculo',
      UPDATE_VEHICLE: 'Actualizar vehiculo',
    };
    return map[type] ?? type;
  }

  formatState(state: Record<string, unknown>): string {
    const parts = Object.entries(state)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${v}`);
    return parts.join(', ');
  }
}
