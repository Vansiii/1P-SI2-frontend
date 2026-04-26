import { Component, OnInit, OnDestroy, AfterViewInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { WebSocketService } from '../../core/services/websocket.service';
import { interval } from 'rxjs';

interface Technician {
  id: number;
  first_name: string;
  last_name: string;
  current_latitude?: number;
  current_longitude?: number;
  is_online: boolean;
  is_available: boolean;
  location_updated_at?: string;
}

interface Incident {
  id: number;
  latitude: number;
  longitude: number;
  descripcion: string;
  estado_actual: string;
  tecnico_id?: number;
}

@Component({
  selector: 'app-technicians-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="map-container">
      <div id="technicians-map" class="map"></div>
      
      <!-- Reloj en tiempo real -->
      <div class="live-clock">
        <div class="clock-time">{{ currentTime() }}</div>
        <div class="clock-date">{{ currentDate() }}</div>
      </div>

      <!-- Controles minimalistas -->
      <div class="map-controls" [class.expanded]="controlsExpanded">
        <button class="toggle-btn" (click)="controlsExpanded = !controlsExpanded">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2 5.2l-4.2-4.2m0-6l4.2-4.2"/>
          </svg>
        </button>
        
        @if (controlsExpanded) {
          <div class="control-options">
            <label class="control-item">
              <input 
                type="checkbox" 
                [(ngModel)]="showTechnicians"
                (change)="toggleTechnicians()"
              />
              <span>Técnicos</span>
            </label>
            <label class="control-item">
              <input 
                type="checkbox" 
                [(ngModel)]="showIncidents"
                (change)="toggleIncidents()"
              />
              <span>Incidentes</span>
            </label>
            <label class="control-item">
              <input 
                type="checkbox" 
                [(ngModel)]="showOnlineOnly"
                (change)="filterTechnicians()"
              />
              <span>Solo en línea</span>
            </label>
          </div>
        }
      </div>

      <!-- Leyenda minimalista -->
      <div class="map-legend" [class.collapsed]="legendCollapsed">
        <button class="legend-toggle" (click)="legendCollapsed = !legendCollapsed">
          <span>Leyenda</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline [attr.points]="legendCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'"/>
          </svg>
        </button>
        
        @if (!legendCollapsed) {
          <div class="legend-content">
            <div class="legend-item">
              <span class="marker online"></span>
              <span>En línea</span>
            </div>
            <div class="legend-item">
              <span class="marker offline"></span>
              <span>Desconectado</span>
            </div>
            <div class="legend-item">
              <span class="marker incident-active"></span>
              <span>Activo</span>
            </div>
            <div class="legend-item">
              <span class="marker incident-pending"></span>
              <span>Pendiente</span>
            </div>
          </div>
        }
      </div>

      <!-- Panel de estadísticas -->
      <div class="stats-panel">
        <div class="stat-card">
          <div class="stat-value">{{ onlineTechnicians }}</div>
          <div class="stat-label">En línea</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-card">
          <div class="stat-value">{{ activeIncidents }}</div>
          <div class="stat-label">Activos</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-card">
          <div class="stat-value">{{ pendingIncidents }}</div>
          <div class="stat-label">Pendientes</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-container {
      position: fixed;
      top: 4.5rem;
      left: 280px;
      right: 0;
      bottom: 0;
      background: #0a0a0a;
      overflow: hidden;
      z-index: 1;
    }

    .map {
      width: 100%;
      height: 100%;
      z-index: 1;
      filter: grayscale(20%) contrast(1.1);
    }

    /* Reloj en tiempo real */
    .live-clock {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      padding: 16px 32px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      z-index: 1000;
      text-align: center;
      animation: slideDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .clock-time {
      font-size: 32px;
      font-weight: 300;
      letter-spacing: -0.02em;
      color: #0a0a0a;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .clock-date {
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #666;
      margin-top: 4px;
    }

    /* Controles minimalistas */
    .map-controls {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 1000;
      animation: slideRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
    }

    .toggle-btn {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border: none;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      color: #0a0a0a;
    }

    .toggle-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    }

    .toggle-btn:active {
      transform: scale(0.95);
    }

    .control-options {
      margin-top: 12px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 12px;
      padding: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .control-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.2s;
      font-size: 14px;
      font-weight: 500;
      color: #0a0a0a;
    }

    .control-item:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .control-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #0a0a0a;
    }

    /* Leyenda minimalista */
    .map-legend {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      overflow: hidden;
      animation: slideLeft 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
    }

    .legend-toggle {
      width: 100%;
      background: none;
      border: none;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #0a0a0a;
      transition: background 0.2s;
    }

    .legend-toggle:hover {
      background: rgba(0, 0, 0, 0.03);
    }

    .legend-toggle svg {
      transition: transform 0.3s;
    }

    .legend-content {
      padding: 8px 16px 16px;
      animation: fadeIn 0.3s;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }

    .legend-item:last-child {
      margin-bottom: 0;
    }

    .marker {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .marker.online {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .marker.offline {
      background: linear-gradient(135deg, #6b7280, #4b5563);
    }

    .marker.incident-active {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }

    .marker.incident-pending {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    /* Panel de estadísticas */
    .stats-panel {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      padding: 16px 24px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 20px;
      animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
    }

    .stat-card {
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #0a0a0a;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #666;
      margin-top: 4px;
    }

    .stat-divider {
      width: 1px;
      height: 32px;
      background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.1), transparent);
    }

    /* Animaciones */
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    @keyframes slideRight {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideLeft {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
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

    /* Estilos para marcadores personalizados */
    :host ::ng-deep .custom-pin-marker {
      background: transparent !important;
      border: none !important;
    }

    :host ::ng-deep .pin-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Estilos para popups personalizados */
    :host ::ng-deep .custom-popup .leaflet-popup-content-wrapper {
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      padding: 0;
      overflow: hidden;
    }

    :host ::ng-deep .custom-popup .leaflet-popup-content {
      margin: 0;
      width: auto !important;
    }

    :host ::ng-deep .custom-popup .leaflet-popup-tip {
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    :host ::ng-deep .custom-popup .leaflet-popup-close-button {
      width: 28px;
      height: 28px;
      font-size: 20px;
      color: #666;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
      top: 8px;
      right: 8px;
    }

    :host ::ng-deep .custom-popup .leaflet-popup-close-button:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #111;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .map-container {
        left: 0;
        top: 4rem;
      }
    }

    @media (max-width: 768px) {
      .map-container {
        top: 4rem;
      }

      .live-clock {
        top: 12px;
        padding: 12px 20px;
      }

      .clock-time {
        font-size: 24px;
      }

      .clock-date {
        font-size: 10px;
      }

      .map-controls,
      .map-legend {
        top: 12px;
      }

      .map-controls {
        left: 12px;
      }

      .map-legend {
        right: 12px;
      }

      .stats-panel {
        bottom: 12px;
        padding: 12px 16px;
        gap: 12px;
        flex-wrap: wrap;
        max-width: calc(100% - 24px);
      }

      .stat-value {
        font-size: 22px;
      }

      .stat-label {
        font-size: 10px;
      }

      .stat-divider {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .map-container {
        top: 3.75rem;
      }

      .live-clock {
        padding: 10px 16px;
      }

      .clock-time {
        font-size: 20px;
      }

      .toggle-btn {
        width: 40px;
        height: 40px;
      }

      .control-options {
        min-width: 160px;
      }

      .stats-panel {
        gap: 8px;
      }

      .stat-card {
        flex: 1;
        min-width: 70px;
      }
    }
  `]
})
export class TechniciansMapComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly wsService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private map?: L.Map;
  private technicianMarkers = new Map<number, L.Marker>();
  private incidentMarkers = new Map<number, L.Marker>();

  technicians: Technician[] = [];
  incidents: Incident[] = [];

  showTechnicians = true;
  showIncidents = true;
  showOnlineOnly = false;
  controlsExpanded = false;
  legendCollapsed = false;

  onlineTechnicians = 0;
  activeIncidents = 0;
  pendingIncidents = 0;

  // Signals para el reloj en tiempo real
  currentTime = signal('');
  currentDate = signal('');

  ngOnInit(): void {
    // Inicializar reloj
    this.updateClock();
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateClock());

    // Conectar al WebSocket general
    this.wsService.connect();

    // Escuchar actualizaciones
    this.wsService.messages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(message => {
        switch (message.type) {
          case 'location_update':
            this.updateTechnicianLocation(message.data);
            break;
          case 'technician_status_change':
            this.updateTechnicianStatus(message.data);
            break;
          case 'incident_created':
            this.addIncident(message.data);
            break;
          case 'incident_status_change':
            this.updateIncidentStatus(message.data);
            break;
        }
      });

    // Cargar datos iniciales
    this.loadInitialData();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
    this.map?.remove();
  }

  private updateClock(): void {
    const now = new Date();
    
    // Formato de hora: HH:MM:SS
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    this.currentTime.set(`${hours}:${minutes}:${seconds}`);
    
    // Formato de fecha: DD MMM YYYY
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    };
    this.currentDate.set(now.toLocaleDateString('es-ES', options));
  }

  private initMap(): void {
    // Inicializar mapa centrado en Santa Cruz, Bolivia
    this.map = L.map('technicians-map').setView([-17.783327, -63.182140], 13);

    // Agregar capa de tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Renderizar marcadores iniciales
    this.renderTechnicians();
    this.renderIncidents();
  }

  private loadInitialData(): void {
    // TODO: Cargar técnicos e incidentes desde API
    // this.technicianService.getAll().subscribe(...)
    // this.incidentService.getActive().subscribe(...)
    
    this.updateStatistics();
  }

  private renderTechnicians(): void {
    if (!this.map || !this.showTechnicians) return;

    this.technicians.forEach(tech => {
      if (!tech.current_latitude || !tech.current_longitude) return;
      if (this.showOnlineOnly && !tech.is_online) return;

      this.addOrUpdateTechnicianMarker(tech);
    });
  }

  private renderIncidents(): void {
    if (!this.map || !this.showIncidents) return;

    this.incidents.forEach(incident => {
      this.addOrUpdateIncidentMarker(incident);
    });
  }

  private addOrUpdateTechnicianMarker(tech: Technician): void {
    if (!this.map || !tech.current_latitude || !tech.current_longitude) return;

    const isOnline = tech.is_online;
    const color = isOnline ? '#10b981' : '#6b7280';
    const pulseColor = isOnline ? 'rgba(16, 185, 129, 0.4)' : 'rgba(107, 114, 128, 0.4)';
    
    // Crear marcador estilo Google Maps con ping
    const icon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="pin-wrapper">
          ${isOnline ? `
            <div class="pulse-ring" style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 60px;
              height: 60px;
              border-radius: 50%;
              background: ${pulseColor};
              animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            "></div>
          ` : ''}
          <div class="pin-container" style="
            position: relative;
            width: 40px;
            height: 50px;
            filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
          ">
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Pin principal -->
              <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34c0-8.837-7.163-16-16-16z" 
                    fill="${color}"/>
              <!-- Borde blanco -->
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" 
                    fill="white" opacity="0.3"/>
              <!-- Círculo interior -->
              <circle cx="20" cy="16" r="8" fill="white"/>
              <!-- Icono de técnico -->
              <g transform="translate(14, 10)">
                <path d="M6 6c1.657 0 3-1.343 3-3S7.657 0 6 0 3 1.343 3 3s1.343 3 3 3zm0 1.5c-2 0-6 1-6 3V12h12v-1.5c0-2-4-3-6-3z" 
                      fill="${color}"/>
              </g>
            </svg>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(0.8);
            }
            50% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.2);
            }
          }
        </style>
      `,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });

    const existingMarker = this.technicianMarkers.get(tech.id);
    
    if (existingMarker) {
      existingMarker.setLatLng([tech.current_latitude, tech.current_longitude]);
      existingMarker.setIcon(icon);
    } else {
      const marker = L.marker(
        [tech.current_latitude, tech.current_longitude],
        { icon }
      ).addTo(this.map);

      // Popup mejorado con diseño moderno
      marker.bindPopup(`
        <div style="
          min-width: 220px;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          ">
            <div style="
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: linear-gradient(135deg, ${color}, ${color}dd);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 20px;
              font-weight: 600;
            ">
              ${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}
            </div>
            <div style="flex: 1;">
              <h3 style="
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #111;
              ">
                ${tech.first_name} ${tech.last_name}
              </h3>
              <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                margin-top: 4px;
              ">
                <span style="
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: ${isOnline ? '#10b981' : '#6b7280'};
                  display: inline-block;
                "></span>
                <span style="
                  font-size: 12px;
                  color: #666;
                  font-weight: 500;
                ">
                  ${isOnline ? 'En línea' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
          <div style="
            padding: 10px 12px;
            background: ${tech.is_available ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
            border-radius: 8px;
            border-left: 3px solid ${tech.is_available ? '#10b981' : '#ef4444'};
          ">
            <span style="
              font-size: 13px;
              font-weight: 600;
              color: ${tech.is_available ? '#059669' : '#dc2626'};
            ">
              ${tech.is_available ? '✓ Disponible' : '✗ No disponible'}
            </span>
          </div>
        </div>
      `, {
        className: 'custom-popup',
        maxWidth: 300
      });

      this.technicianMarkers.set(tech.id, marker);
    }
  }

  private addOrUpdateIncidentMarker(incident: Incident): void {
    if (!this.map) return;

    const isPending = incident.estado_actual === 'pendiente';
    const color = isPending ? '#ef4444' : '#f59e0b';
    const pulseColor = isPending ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)';
    
    // Crear marcador estilo Google Maps con ping para incidentes
    const icon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="pin-wrapper">
          <div class="pulse-ring" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${pulseColor};
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          "></div>
          <div class="pin-container" style="
            position: relative;
            width: 40px;
            height: 50px;
            filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
          ">
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Pin principal -->
              <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34c0-8.837-7.163-16-16-16z" 
                    fill="${color}"/>
              <!-- Borde blanco -->
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" 
                    fill="white" opacity="0.3"/>
              <!-- Círculo interior -->
              <circle cx="20" cy="16" r="8" fill="white"/>
              <!-- Icono de alerta -->
              <g transform="translate(18, 9)">
                <path d="M2 0L0 4h4L2 0z" fill="${color}"/>
                <circle cx="2" cy="5.5" r="0.8" fill="${color}"/>
              </g>
            </svg>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(0.8);
            }
            50% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.2);
            }
          }
        </style>
      `,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });

    const existingMarker = this.incidentMarkers.get(incident.id);
    
    if (existingMarker) {
      existingMarker.setIcon(icon);
    } else {
      const marker = L.marker(
        [incident.latitude, incident.longitude],
        { icon }
      ).addTo(this.map);

      // Popup mejorado con diseño moderno
      const statusColors: Record<string, { bg: string; border: string; text: string }> = {
        'pendiente': { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#dc2626' },
        'en_progreso': { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#d97706' },
        'resuelto': { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#059669' }
      };
      
      const statusStyle = statusColors[incident.estado_actual] || statusColors['pendiente'];

      marker.bindPopup(`
        <div style="
          min-width: 260px;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          ">
            <h3 style="
              margin: 0;
              font-size: 16px;
              font-weight: 600;
              color: #111;
            ">
              Incidente #${incident.id}
            </h3>
            <span style="
              padding: 4px 10px;
              background: ${statusStyle.bg};
              border: 1px solid ${statusStyle.border};
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              color: ${statusStyle.text};
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              ${incident.estado_actual.replace('_', ' ')}
            </span>
          </div>
          <p style="
            margin: 0 0 12px 0;
            font-size: 14px;
            line-height: 1.5;
            color: #333;
          ">
            ${incident.descripcion}
          </p>
          <div style="
            padding: 10px 12px;
            background: rgba(0, 0, 0, 0.03);
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span style="
              font-size: 12px;
              color: #666;
              font-weight: 500;
            ">
              Lat: ${incident.latitude.toFixed(6)}, Lng: ${incident.longitude.toFixed(6)}
            </span>
          </div>
        </div>
      `, {
        className: 'custom-popup',
        maxWidth: 320
      });

      this.incidentMarkers.set(incident.id, marker);
    }
  }

  private updateTechnicianLocation(data: any): void {
    const tech = this.technicians.find(t => t.id === data.technician_id);
    if (tech) {
      tech.current_latitude = data.latitude;
      tech.current_longitude = data.longitude;
      tech.location_updated_at = new Date().toISOString();
      this.addOrUpdateTechnicianMarker(tech);
    }
  }

  private updateTechnicianStatus(data: any): void {
    const tech = this.technicians.find(t => t.id === data.technician_id);
    if (tech) {
      tech.is_online = data.is_online;
      tech.is_available = data.is_available;
      this.addOrUpdateTechnicianMarker(tech);
      this.updateStatistics();
    }
  }

  private addIncident(data: any): void {
    this.incidents.push(data);
    this.addOrUpdateIncidentMarker(data);
    this.updateStatistics();
  }

  private updateIncidentStatus(data: any): void {
    const incident = this.incidents.find(i => i.id === data.incident_id);
    if (incident) {
      incident.estado_actual = data.new_status;
      this.addOrUpdateIncidentMarker(incident);
      this.updateStatistics();
    }
  }

  toggleTechnicians(): void {
    if (this.showTechnicians) {
      this.renderTechnicians();
    } else {
      this.technicianMarkers.forEach(marker => marker.remove());
      this.technicianMarkers.clear();
    }
  }

  toggleIncidents(): void {
    if (this.showIncidents) {
      this.renderIncidents();
    } else {
      this.incidentMarkers.forEach(marker => marker.remove());
      this.incidentMarkers.clear();
    }
  }

  filterTechnicians(): void {
    this.technicianMarkers.forEach(marker => marker.remove());
    this.technicianMarkers.clear();
    this.renderTechnicians();
  }

  private updateStatistics(): void {
    this.onlineTechnicians = this.technicians.filter(t => t.is_online).length;
    this.activeIncidents = this.incidents.filter(
      i => i.estado_actual !== 'pendiente' && i.estado_actual !== 'resuelto'
    ).length;
    this.pendingIncidents = this.incidents.filter(
      i => i.estado_actual === 'pendiente'
    ).length;
  }
}
