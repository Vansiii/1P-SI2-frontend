import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import * as L from 'leaflet';

interface RutaData {
  origen: { lat: number; lng: number; nombre: string };
  destino: { lat: number; lng: number; nombre: string };
  ruta: {
    polyline: { lat: number; lng: number }[] | null;
    distancia_km: number;
    duracion_minutos: number;
  };
  fuente: string;
}

@Component({
  selector: 'app-cotizacion-mapa',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="tracking-container">
      <a class="back-button" [routerLink]="['/workshop/cotizaciones', cotizacionId()]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Volver</span>
      </a>

      <div class="map-section">
        <div id="cotizacion-map" style="width:100%;height:100%"></div>
      </div>

      @if (rutaData()) {
        <div class="route-panel">
          <div class="route-points">
            <div class="point">
              <div class="point-icon incident"></div>
              <div>
                <div class="point-label">Origen</div>
                <div class="point-name">{{ rutaData()!.origen.nombre }}</div>
              </div>
            </div>
            <svg class="point-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <div class="point">
              <div class="point-icon workshop"></div>
              <div>
                <div class="point-label">Destino</div>
                <div class="point-name">{{ rutaData()!.destino.nombre }}</div>
              </div>
            </div>
          </div>
          <div class="route-stats">
            <div class="stat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              <span>{{ rutaData()!.ruta.distancia_km }} km</span>
            </div>
            <div class="stat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{{ rutaData()!.ruta.duracion_minutos }} min</span>
            </div>
            <span class="source-badge">{{ rutaData()!.fuente === 'osrm' ? 'OSRM' : 'Estimado' }}</span>
          </div>
        </div>
      }

      @if (loading) {
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
          <span>Cargando ruta...</span>
        </div>
      }
      @if (error()) {
        <div class="error-overlay">{{ error() }}</div>
      }
    </div>
  `,
  styles: [`
    .tracking-container {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #0a0a0a;
      z-index: 1000;
    }
    .back-button {
      position: absolute;
      top: 20px; left: 20px;
      z-index: 1001;
      background: rgba(255,255,255,0.95);
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
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    .back-button:hover {
      transform: translateX(-4px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.15);
    }
    .map-section {
      width: 100%;
      height: 100%;
    }
    .route-panel {
      position: absolute;
      bottom: 24px; left: 24px; right: 24px;
      z-index: 1001;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      animation: slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both;
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .route-points {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .point {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .point-icon {
      width: 12px; height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .point-icon.incident {
      background: #ef4444;
      box-shadow: 0 0 0 4px rgba(239,68,68,0.2);
    }
    .point-icon.workshop {
      background: #8b5cf6;
      box-shadow: 0 0 0 4px rgba(139,92,246,0.2);
    }
    .point-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
    }
    .point-name {
      font-size: 13px;
      font-weight: 600;
      color: #1f2937;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .point-arrow {
      flex-shrink: 0;
    }
    .route-stats {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 700;
      color: #0a0a0a;
    }
    .stat svg { color: #6b7280; }
    .source-badge {
      margin-left: auto;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 99px;
      background: #f3f4f6;
      color: #6b7280;
      font-weight: 500;
    }
    .loading-overlay, .error-overlay {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%,-50%);
      z-index: 1002;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(20px);
      padding: 20px 32px;
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    }
    .error-overlay { color: #991b1b; background: #fef2f2; }
    .loading-spinner {
      width: 28px; height: 28px;
      border: 3px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CotizacionMapaComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private map: L.Map | null = null;

  cotizacionId = signal<number>(0);
  rutaData = signal<RutaData | null>(null);
  loading = true;
  error = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.cotizacionId.set(id);
      this.loadRuta(id);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private loadRuta(id: number): void {
    this.http.get<{ data: RutaData }>(`${environment.apiUrl}/workshop/cotizaciones/${id}/ruta`).subscribe({
      next: (res) => {
        this.rutaData.set(res.data);
        this.loading = false;
        setTimeout(() => this.initMap(), 100);
      },
      error: () => {
        this.loading = false;
        this.error.set('Error al cargar la ruta');
      },
    });
  }

  private initMap(): void {
    const r = this.rutaData();
    if (!r) return;

    this.map = L.map('cotizacion-map', {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(this.map);

    const puntos: L.LatLng[] = [];

    // Draw route polyline - same style as IncidentMapComponent OSRM route
    if (r.ruta.polyline && r.ruta.polyline.length > 0) {
      const coords = r.ruta.polyline.map(p => L.latLng(p.lat, p.lng));
      L.polyline(coords, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7,
      }).addTo(this.map);
      puntos.push(...coords);
    }

    const origen = L.latLng(r.origen.lat, r.origen.lng);
    const destino = L.latLng(r.destino.lat, r.destino.lng);
    puntos.push(origen, destino);

    // Incident marker - identical to IncidentMapComponent
    const incidentIcon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="pin-wrapper">
          <div class="pulse-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border-radius:50%;background:rgba(239,68,68,0.4);animation:pulse-cot 2s cubic-bezier(0.4,0,0.6,1) infinite;"></div>
          <div class="pin-container" style="position:relative;width:40px;height:50px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3));">
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34c0-8.837-7.163-16-16-16z" fill="#ef4444"/>
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" fill="white" opacity="0.3"/>
              <circle cx="20" cy="16" r="8" fill="white"/>
              <g transform="translate(18,9)">
                <circle cx="2" cy="0" r="1.5" fill="#ef4444"/>
                <path d="M2 2L0 6h4L2 2z" fill="#ef4444"/>
              </g>
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
    });
    L.marker(origen, { icon: incidentIcon }).addTo(this.map!);

    // Workshop marker - identical to IncidentMapComponent
    const workshopIcon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="pin-wrapper">
          <div class="pulse-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border-radius:50%;background:rgba(139,92,246,0.4);animation:pulse-cot 2s cubic-bezier(0.4,0,0.6,1) infinite;"></div>
          <div class="pin-container" style="position:relative;width:40px;height:50px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3));">
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34c0-8.837-7.163-16-16-16z" fill="#8b5cf6"/>
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" fill="white" opacity="0.3"/>
              <circle cx="20" cy="16" r="8" fill="white"/>
              <g transform="translate(13,9)">
                <path d="M7 0L0 4v8l7 4 7-4V4L7 0zm0 2l4.5 2.5v5L7 12l-4.5-2.5v-5L7 2z" fill="#8b5cf6"/>
              </g>
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
    });
    L.marker(destino, { icon: workshopIcon }).addTo(this.map!);

    // Add pulse animation style
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes pulse-cot {
        0%, 100% { opacity: 1; transform: translate(-50%,-50%) scale(0.8); }
        50% { opacity: 0; transform: translate(-50%,-50%) scale(1.2); }
      }
    `;
    document.head.appendChild(styleEl);

    if (puntos.length > 0) {
      this.map!.fitBounds(L.latLngBounds(puntos), { padding: [80, 80] });
    } else {
      this.map!.setView(origen, 14);
    }
  }
}
