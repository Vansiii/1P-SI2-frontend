import { Component, Input, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { WebSocketService } from '../../core/services/websocket.service';
import { TrackingService, LocationHistory } from '../../core/services/tracking.service';
import { Subscription, interval } from 'rxjs';

interface Incident {
  id: number;
  latitude: number;
  longitude: number;
  descripcion: string;
  estado_actual: string;
  tecnico_id?: number;
  taller_id?: number;
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

@Component({
  selector: 'app-incident-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-container">
      <div id="map" class="map"></div>
      
      <!-- Reloj en tiempo real -->
      <div class="live-clock">
        <div class="clock-time">{{ currentTime() }}</div>
        <div class="clock-date">{{ currentDate() }}</div>
      </div>

      <!-- Información del incidente -->
      <div class="incident-info">
        <div class="info-header">
          <span class="incident-badge">Incidente #{{ incident.id }}</span>
          <span class="status-badge" [class]="'status-' + incident.estado_actual">
            {{ incident.estado_actual }}
          </span>
        </div>
        <p class="incident-description">{{ incident.descripcion }}</p>
      </div>
      
      @if (showLegend) {
        <div class="map-legend" [class.collapsed]="legendCollapsed">
          <button class="legend-toggle" (click)="legendCollapsed = !legendCollapsed">
            <span>Detalles</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline [attr.points]="legendCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'"/>
            </svg>
          </button>
          
          @if (!legendCollapsed) {
            <div class="legend-content">
              <div class="legend-item">
                <span class="marker incident"></span>
                <span>Ubicación del cliente</span>
              </div>
              @if (workshop) {
                <div class="legend-item">
                  <span class="marker workshop"></span>
                  <span>Taller asignado</span>
                </div>
              }
              @if (technician) {
                <div class="legend-item">
                  <span class="marker technician"></span>
                  <span>Técnico en ruta</span>
                </div>
                <div class="legend-note">
                  <small>El técnico se dirige hacia tu ubicación</small>
                </div>
              } @else if (workshop) {
                <div class="legend-note">
                  <small>Esperando asignación de técnico</small>
                </div>
              }
              @if (estimatedDistance) {
                <div class="info-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12h18M3 6h18M3 18h18"/>
                  </svg>
                  <span>{{ estimatedDistance.toFixed(2) }} km</span>
                </div>
              }
              @if (estimatedTime) {
                <div class="info-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>{{ estimatedTime }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .map-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: #0a0a0a;
      overflow: hidden;
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

    /* Información del incidente */
    .incident-info {
      position: absolute;
      top: 80px;
      left: 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      max-width: 320px;
      animation: slideRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
    }

    .info-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .incident-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #0a0a0a;
      background: rgba(0, 0, 0, 0.08);
      padding: 4px 10px;
      border-radius: 6px;
    }

    .status-badge {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .status-badge.status-pendiente {
      background: rgba(239, 68, 68, 0.15);
      color: #dc2626;
    }

    .status-badge.status-en_progreso {
      background: rgba(245, 158, 11, 0.15);
      color: #d97706;
    }

    .status-badge.status-resuelto {
      background: rgba(16, 185, 129, 0.15);
      color: #059669;
    }

    .incident-description {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #333;
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

    .legend-note {
      margin-top: 8px;
      padding: 8px;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 6px;
      font-size: 11px;
      color: #2563eb;
      font-style: italic;
    }

    .marker {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      flex-shrink: 0;
    }

    .marker.incident {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    .marker.technician {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
    }

    .marker.workshop {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      font-size: 13px;
      font-weight: 500;
      color: #0a0a0a;
    }

    .info-row svg {
      flex-shrink: 0;
      color: #666;
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
    @media (max-width: 768px) {
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

      .incident-info {
        top: 60px;
        left: 12px;
        max-width: calc(100% - 24px);
      }

      .map-legend {
        top: auto;
        bottom: 12px;
        right: 12px;
      }
    }

    @media (max-width: 480px) {
      .live-clock {
        padding: 10px 16px;
      }

      .clock-time {
        font-size: 20px;
      }

      .incident-info {
        padding: 12px 16px;
      }

      .incident-description {
        font-size: 12px;
      }
    }
  `]
})
export class IncidentMapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  private readonly wsService = inject(WebSocketService);
  private readonly trackingService = inject(TrackingService);

  @Input() incident!: Incident;
  @Input() technician?: Technician;
  @Input() workshop?: Workshop;
  @Input() showLegend = true;
  @Input() autoCenter = true;

  private map?: L.Map;
  private incidentMarker?: L.Marker;
  private technicianMarker?: L.Marker;
  private workshopMarker?: L.Marker;
  private routeLine?: L.Polyline;
  private wsSubscription?: Subscription;
  private clockSubscription?: Subscription;

  estimatedDistance?: number;
  estimatedTime?: string;
  legendCollapsed = false;

  // Signals para el reloj en tiempo real
  currentTime = signal('');
  currentDate = signal('');

  ngOnInit(): void {
    // Inicializar reloj
    this.updateClock();
    this.clockSubscription = interval(1000).subscribe(() => this.updateClock());

    // Conectar al WebSocket del incidente
    this.wsService.connect(this.incident.id);

    // Escuchar actualizaciones de ubicación
    this.wsSubscription = this.wsService.messages$.subscribe(message => {
      if (message.type === 'location_update') {
        this.updateTechnicianLocation(
          message.data.latitude,
          message.data.longitude
        );
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reaccionar cuando workshop o technician llegan después de que el mapa ya se inicializó
    if (!this.map) return;

    if (changes['workshop'] && this.workshop?.latitude && this.workshop?.longitude) {
      // Remover marcador anterior si existe
      if (this.workshopMarker) {
        this.workshopMarker.remove();
        this.workshopMarker = undefined;
      }
      this.addWorkshopMarker();
      this.fitMapBounds();
    }

    if (changes['technician']) {
      const tech = this.technician;
      if (tech?.current_latitude && tech?.current_longitude) {
        if (this.technicianMarker) {
          this.technicianMarker.setLatLng([tech.current_latitude, tech.current_longitude]);
        } else {
          this.addTechnicianMarker(tech.current_latitude, tech.current_longitude);
        }
        this.fitMapBounds();
      }
    }
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    this.clockSubscription?.unsubscribe();
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
    // Inicializar mapa centrado en el incidente
    this.map = L.map('map').setView(
      [this.incident.latitude, this.incident.longitude],
      14
    );

    // Agregar capa de tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Agregar marcador del incidente (cliente)
    this.addIncidentMarker();

    // Agregar marcador del taller si está disponible
    if (this.workshop?.latitude && this.workshop?.longitude) {
      this.addWorkshopMarker();
    }

    // Solo agregar marcador del técnico si está asignado
    // Cuando hay técnico, mostramos taller + técnico (el técnico va hacia el cliente)
    if (this.technician?.current_latitude && this.technician?.current_longitude) {
      this.addTechnicianMarker(
        this.technician.current_latitude,
        this.technician.current_longitude
      );
      
      // Cargar historial de ubicaciones del técnico
      if (this.incident.tecnico_id) {
        this.loadTechnicianHistory();
      }
    }

    // Ajustar vista del mapa
    this.fitMapBounds();
  }

  private addIncidentMarker(): void {
    const incidentIcon = L.divIcon({
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
            background: rgba(239, 68, 68, 0.4);
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
                    fill="#ef4444"/>
              <!-- Borde blanco -->
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" 
                    fill="white" opacity="0.3"/>
              <!-- Círculo interior -->
              <circle cx="20" cy="16" r="8" fill="white"/>
              <!-- Icono de alerta -->
              <g transform="translate(18, 9)">
                <path d="M2 0L0 4h4L2 0z" fill="#ef4444"/>
                <circle cx="2" cy="5.5" r="0.8" fill="#ef4444"/>
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

    this.incidentMarker = L.marker(
      [this.incident.latitude, this.incident.longitude],
      { icon: incidentIcon }
    ).addTo(this.map!);

    const statusColors: Record<string, { bg: string; border: string; text: string }> = {
      'pendiente': { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#dc2626' },
      'en_progreso': { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#d97706' },
      'resuelto': { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#059669' }
    };
    
    const statusStyle = statusColors[this.incident.estado_actual] || statusColors['pendiente'];

    this.incidentMarker.bindPopup(`
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
            Incidente #${this.incident.id}
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
            ${this.incident.estado_actual.replace('_', ' ')}
          </span>
        </div>
        <p style="
          margin: 0 0 12px 0;
          font-size: 14px;
          line-height: 1.5;
          color: #333;
        ">
          ${this.incident.descripcion}
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
            Lat: ${this.incident.latitude.toFixed(6)}, Lng: ${this.incident.longitude.toFixed(6)}
          </span>
        </div>
      </div>
    `, {
      className: 'custom-popup',
      maxWidth: 320
    });
  }

  private addTechnicianMarker(lat: number, lng: number): void {
    const isOnline = this.technician?.is_online ?? true;
    const color = isOnline ? '#3b82f6' : '#6b7280';
    const pulseColor = isOnline ? 'rgba(59, 130, 246, 0.4)' : 'rgba(107, 114, 128, 0.4)';
    
    const technicianIcon = L.divIcon({
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

    if (this.technicianMarker) {
      // Actualizar posición existente con animación
      this.technicianMarker.setLatLng([lat, lng]);
      this.technicianMarker.setIcon(technicianIcon);
    } else {
      // Crear nuevo marcador
      this.technicianMarker = L.marker([lat, lng], { icon: technicianIcon })
        .addTo(this.map!);

      if (this.technician) {
        this.technicianMarker.bindPopup(`
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
                ${this.technician.first_name.charAt(0)}${this.technician.last_name.charAt(0)}
              </div>
              <div style="flex: 1;">
                <h3 style="
                  margin: 0;
                  font-size: 16px;
                  font-weight: 600;
                  color: #111;
                ">
                  ${this.technician.first_name} ${this.technician.last_name}
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
              background: rgba(59, 130, 246, 0.1);
              border-radius: 8px;
              border-left: 3px solid #3b82f6;
            ">
              <span style="
                font-size: 13px;
                font-weight: 600;
                color: #2563eb;
              ">
                🚗 En camino al incidente
              </span>
            </div>
          </div>
        `, {
          className: 'custom-popup',
          maxWidth: 300
        });
      }
    }

    // Calcular distancia y tiempo estimado
    this.calculateDistanceAndETA(lat, lng);

    // Ajustar vista del mapa si autoCenter está habilitado
    if (this.autoCenter) {
      this.fitMapBounds();
    }
  }

  private updateTechnicianLocation(lat: number, lng: number): void {
    this.addTechnicianMarker(lat, lng);
  }

  private calculateDistanceAndETA(techLat: number, techLng: number): void {
    // Calcular distancia usando fórmula Haversine
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(techLat - this.incident.latitude);
    const dLon = this.toRad(techLng - this.incident.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(this.incident.latitude)) * 
      Math.cos(this.toRad(techLat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    this.estimatedDistance = R * c;

    // Calcular tiempo estimado (asumiendo 40 km/h promedio)
    const avgSpeed = 40;
    const timeHours = this.estimatedDistance / avgSpeed;
    const timeMinutes = Math.round(timeHours * 60);

    if (timeMinutes < 1) {
      this.estimatedTime = 'Menos de 1 min';
    } else if (timeMinutes < 60) {
      this.estimatedTime = `${timeMinutes} min`;
    } else {
      const hours = Math.floor(timeMinutes / 60);
      const minutes = timeMinutes % 60;
      this.estimatedTime = `${hours} h ${minutes} min`;
    }
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private addWorkshopMarker(): void {
    if (!this.map || !this.workshop) return;

    const workshopIcon = L.divIcon({
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
            background: rgba(139, 92, 246, 0.4);
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
                    fill="#8b5cf6"/>
              <!-- Borde blanco -->
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" 
                    fill="white" opacity="0.3"/>
              <!-- Círculo interior -->
              <circle cx="20" cy="16" r="8" fill="white"/>
              <!-- Icono de taller -->
              <g transform="translate(13, 9)">
                <path d="M7 0L0 4v8l7 4 7-4V4L7 0zm0 2l4.5 2.5v5L7 12l-4.5-2.5v-5L7 2z" 
                      fill="#8b5cf6"/>
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

    this.workshopMarker = L.marker(
      [this.workshop.latitude, this.workshop.longitude],
      { icon: workshopIcon }
    ).addTo(this.map);

    this.workshopMarker.bindPopup(`
      <div style="
        min-width: 240px;
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
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
          ">
            🔧
          </div>
          <div style="flex: 1;">
            <h3 style="
              margin: 0;
              font-size: 16px;
              font-weight: 600;
              color: #111;
            ">
              ${this.workshop.workshop_name}
            </h3>
            <div style="
              font-size: 12px;
              color: #666;
              margin-top: 4px;
            ">
              Taller asignado
            </div>
          </div>
        </div>
        ${this.workshop.address ? `
          <div style="
            padding: 10px 12px;
            background: rgba(139, 92, 246, 0.1);
            border-radius: 8px;
            border-left: 3px solid #8b5cf6;
            font-size: 13px;
            color: #374151;
          ">
            📍 ${this.workshop.address}
          </div>
        ` : ''}
      </div>
    `, {
      className: 'custom-popup',
      maxWidth: 300
    });
  }

  private fitMapBounds(): void {
    if (!this.map || !this.incidentMarker) return;

    const markers: L.LatLng[] = [];
    
    // Si hay técnico asignado, mostrar taller + técnico
    if (this.technicianMarker && this.workshopMarker) {
      markers.push(this.workshopMarker.getLatLng());
      markers.push(this.technicianMarker.getLatLng());
    }
    // Si solo hay taller, mostrar taller + cliente
    else if (this.workshopMarker) {
      markers.push(this.incidentMarker.getLatLng());
      markers.push(this.workshopMarker.getLatLng());
    }
    // Si no hay nada, solo mostrar cliente
    else {
      markers.push(this.incidentMarker.getLatLng());
    }

    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers);
      this.map.fitBounds(bounds, { padding: [80, 80] });
    } else {
      this.map.setView(markers[0], 14);
    }
  }

  private loadTechnicianHistory(): void {
    if (!this.incident.tecnico_id) return;

    // Cargar últimas 50 ubicaciones
    this.trackingService.getTechnicianHistory(
      this.incident.tecnico_id,
      undefined,
      undefined,
      50
    ).subscribe({
      next: (history) => {
        if (history.length > 0) {
          this.drawRoute(history);
        }
      },
      error: (error) => {
        console.error('Error loading technician history:', error);
      }
    });
  }

  private drawRoute(history: LocationHistory[]): void {
    if (!this.map || history.length < 2) return;

    // Crear línea de ruta
    const latlngs: L.LatLngExpression[] = history
      .reverse() // Ordenar del más antiguo al más reciente
      .map(loc => [loc.latitude, loc.longitude]);

    if (this.routeLine) {
      this.routeLine.setLatLngs(latlngs);
    } else {
      this.routeLine = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.6,
        dashArray: '10, 10'
      }).addTo(this.map);
    }
  }
}
