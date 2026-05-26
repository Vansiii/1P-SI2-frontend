import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IncidentsService, type IncidentAiAnalysis } from '../../../core/services/incidents.service';
import { environment } from '../../../../environments/environment';

interface ApiIncidentRaw {
  id: number;
  client_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  latitude: number;
  longitude: number;
  direccion_referencia: string | null;
  descripcion: string;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  estado_actual: string;
  created_at: string;
  technician?: any;
  workshop?: any;
}

interface UnifiedIncident {
  id: number;
  descripcion: string;
  estado_actual: string;
  prioridad_ia: string | null;
  categoria_ia: string | null;
  latitude: number | null;
  longitude: number | null;
  direccion_referencia: string | null;
  created_at: string;
  technician?: any;
  workshop?: any;
}

interface ApiResponse {
  success: boolean;
  data: ApiIncidentRaw[];
}

@Component({
  selector: 'app-workshop-map-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-map-page.html',
  styleUrl: './workshop-map-page.css'
})
export class WorkshopMapPageComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly incidentsService = inject(IncidentsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  incidents = signal<UnifiedIncident[]>([]);
  filteredIncidents = signal<UnifiedIncident[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  
  selectedFilter = signal('todos');
  searchQuery = signal('');
  
  private map: any = null;
  private markers: any[] = [];
  private L: any = null;
  selectedIncident = signal<UnifiedIncident | null>(null);

  ngOnInit(): void {
    this.loadIncidents();
    this.loadLeaflet();
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  async loadLeaflet(): Promise<void> {
    try {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!(window as any).L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          script.onerror = (e) => { console.warn('Leaflet failed to load', e); reject(e); };
          document.head.appendChild(script);
        });
      }
      this.L = (window as any).L;
      
      setTimeout(() => this.initMap(), 100);
    } catch (e) {
      console.warn('Leaflet not available', e);
    }
  }

  loadIncidents(): void {
    this.loading.set(true);
    const requests = [
      this.http.get<ApiResponse>(`${this.apiUrl}/pendientes/asignacion`),
      this.http.get<ApiResponse>(`${this.apiUrl}?estado=asignado`),
      this.http.get<ApiResponse>(`${this.apiUrl}?estado=en_proceso`),
      this.http.get<ApiResponse>(`${this.apiUrl}?estado=resuelto`)
    ];

    Promise.all(requests.map(r => r.toPromise())).then((responses: any[]) => {
      const raw: ApiIncidentRaw[] = [
        ...(responses[0]?.data || []),
        ...(responses[1]?.data || []),
        ...(responses[2]?.data || []),
        ...(responses[3]?.data || [])
      ];
      const incidents = raw.map(r => ({
        id: r.id,
        descripcion: r.descripcion,
        estado_actual: r.estado_actual,
        prioridad_ia: r.prioridad_ia,
        categoria_ia: r.categoria_ia,
        latitude: r.latitude,
        longitude: r.longitude,
        direccion_referencia: r.direccion_referencia,
        created_at: r.created_at,
        technician: r.technician,
        workshop: r.workshop
      }));
      this.incidents.set(incidents);
      this.applyFilter();
      this.loading.set(false);
    }).catch(err => {
      console.error('Error loading incidents:', err);
      this.error.set('Error al cargar solicitudes');
      this.loading.set(false);
    });
  }

  applyFilter(): void {
    const filter = this.selectedFilter();
    const query = this.searchQuery().toLowerCase();
    let filtered = this.incidents();

    if (filter !== 'todos') {
      filtered = filtered.filter(i => i.estado_actual === filter);
    }

    if (query) {
      filtered = filtered.filter(i =>
        i.descripcion.toLowerCase().includes(query) ||
        String(i.id).includes(query) ||
        (i.direccion_referencia && i.direccion_referencia.toLowerCase().includes(query))
      );
    }

    this.filteredIncidents.set(filtered);

    if (this.map) {
      this.updateMarkers();
    }
  }

  onFilterChange(filter: string): void {
    this.selectedFilter.set(filter);
    this.applyFilter();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.applyFilter();
  }

  initMap(): void {
    const mapElement = document.getElementById('fullscreen-map');
    if (!mapElement || !this.L) return;

    mapElement.innerHTML = '';

    try {
      this.map = this.L.map('fullscreen-map', {
        zoomControl: false,
        attributionControl: false
      });

      this.L.control.zoom({ position: 'topright' }).addTo(this.map);

      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(this.map);

      this.map.setView([-16.5, -68.15], 6);

      setTimeout(() => this.map?.invalidateSize(), 100);

      this.updateMarkers();

      document.addEventListener('selectIncident', ((e: CustomEvent) => {
        const id = e.detail as number;
        const incident = this.incidents().find(i => i.id === id);
        if (incident) {
          this.selectedIncident.set(incident);
        }
      }) as EventListener);

    } catch (e) {
      console.error('Error initializing map:', e);
    }
  }

  updateMarkers(): void {
    if (!this.map || !this.L) return;

    this.markers.forEach(m => m.remove());
    this.markers = [];

    const incidents = this.filteredIncidents();
    if (incidents.length === 0) return;

    const bounds = this.L.latLngBounds([]);

    incidents.forEach(incident => {
      if (!incident.latitude || !incident.longitude) return;

      const position: [number, number] = [incident.latitude, incident.longitude];
      const color = this.getMarkerColor(incident.estado_actual);

      const icon = this.L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div class="pin-wrapper">
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
              <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34C36 7.163 28.837 0 20 0z" fill="${color}"/>
              <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" fill="white" opacity="0.3"/>
              <circle cx="20" cy="16" r="8" fill="white"/>
              <text x="20" y="20" text-anchor="middle" font-size="8" font-weight="bold" fill="${color}">${incident.id}</text>
            </svg>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
      });

      const marker = this.L.marker(position, { icon }).addTo(this.map);

      const estadoLabel = this.getEstadoLabel(incident.estado_actual);

      marker.bindPopup(`
        <div style="min-width: 250px; font-family: system-ui; padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 16px;">#${incident.id}</strong>
            <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${color}; color: white;">
              ${estadoLabel}
            </span>
          </div>
          <p style="margin: 8px 0; font-size: 13px; color: #374151; line-height: 1.4;">
            ${incident.descripcion.substring(0, 80)}${incident.descripcion.length > 80 ? '...' : ''}
          </p>
          ${incident.direccion_referencia ? `
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
              📍 ${incident.direccion_referencia.substring(0, 50)}${incident.direccion_referencia.length > 50 ? '...' : ''}
            </p>
          ` : ''}
          <button onclick="document.dispatchEvent(new CustomEvent('viewIncidentDetail', {detail: ${incident.id}}))"
                  style="width: 100%; margin-top: 12px; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">
            Ver Detalle
          </button>
        </div>
      `);

      marker.on('click', () => {
        this.selectedIncident.set(incident);
      });

      this.markers.push(marker);
      bounds.extend(position);
    });

    if (this.markers.length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    document.addEventListener('viewIncidentDetail', ((e: CustomEvent) => {
      const id = e.detail as number;
      this.router.navigate(['/workshop/incidents', id]);
    }) as EventListener);
  }

  destroyMap(): void {
    if (this.map) {
      this.markers.forEach(m => {
        if (this.map.hasLayer(m)) this.map.removeLayer(m);
      });
      this.markers = [];
      this.map.remove();
      this.map = null;
    }
  }

  getMarkerColor(estado: string): string {
    const colors: Record<string, string> = {
      'pendiente': '#f59e0b',
      'asignado': '#3b82f6',
      'en_proceso': '#8b5cf6',
      'resuelto': '#10b981',
      'cancelado': '#6b7280'
    };
    return colors[estado] || '#6b7280';
  }

  getEstadoLabel(estado: string): string {
    const labels: Record<string, string> = {
      'pendiente': 'Pendiente',
      'asignado': 'Asignado',
      'aceptado': 'Aceptado',
      'en_camino': 'En Camino',
      'en_proceso': 'En Proceso',
      'resuelto': 'Resuelto'
    };
    return labels[estado] || estado;
  }

  goBack(): void {
    this.router.navigate(['/workshop/incidents']);
  }

  viewIncidentDetail(id: number): void {
    this.router.navigate(['/workshop/incidents', id]);
  }
}