import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface Incident {
  id: number;
  descripcion: string;
  estado_actual: string;
  prioridad_ia: string | null;
  categoria_ia: string | null;
  created_at: string;
  direccion_referencia: string | null;
  latitude: number;
  longitude: number;
  client_id: number;
  vehiculo_id: number;
}

interface IncidentDetail extends Incident {
  evidencias?: Evidencia[];
  imagenes?: EvidenciaImagen[];
  audios?: EvidenciaAudio[];
}

interface Evidencia {
  id: number;
  tipo: string;
  descripcion: string;
  created_at: string;
}

interface EvidenciaImagen {
  id: number;
  file_url: string;
  file_name: string;
  created_at: string;
}

interface EvidenciaAudio {
  id: number;
  file_url: string;
  file_name: string;
  created_at: string;
}

interface ApiResponse {
  success: boolean;
  data: Incident[];
  message: string;
}

interface ApiDetailResponse {
  success: boolean;
  data: IncidentDetail;
  message: string;
}

@Component({
  selector: 'app-incidents-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incidents-list.html',
  styleUrl: './incidents-list.css'
})
export class IncidentsListComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  incidents = signal<Incident[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  selectedFilter = signal<string>('todos');
  selectedIncident = signal<IncidentDetail | null>(null);
  loadingDetail = signal(false);
  viewMode = signal<'list' | 'map'>('list');
  showRejectModal = signal(false);
  rejectReason = signal('');
  isProcessing = signal(false);
  selectedImage = signal<string | null>(null);
  
  // Contadores de estados
  statusCounts = signal({
    pendiente: 0,
    asignado: 0,
    en_proceso: 0,
    resuelto: 0,
    total: 0
  });

  private map: any = null;
  private markers: any[] = [];
  private L: any = null;

  readonly filteredIncidents = computed(() => {
    return this.incidents();
  });

  readonly incidentsByStatus = computed(() => {
    return this.statusCounts();
  });

  constructor() {
    // Manejar mini-mapa en vista de detalle
    effect(() => {
      const incident = this.selectedIncident();
      if (incident && this.viewMode() === 'list') {
        setTimeout(() => this.initMiniMap(incident), 100);
      }
    });

    // Manejar cambio de vista entre lista y mapa
    effect(() => {
      const mode = this.viewMode();
      
      if (mode === 'map') {
        // Cerrar el detalle cuando se cambia a vista de mapa
        this.selectedIncident.set(null);
        
        // Limpiar el mapa anterior si existe
        if (this.map) {
          console.log('Removing old map instance');
          this.map.remove();
          this.map = null;
          this.markers = [];
        }
        
        // Cargar incidentes según el filtro seleccionado
        this.loadIncidentsForMap();
        
        // Inicializar el mapa después de un pequeño delay
        setTimeout(() => {
          this.initMap();
        }, 100);
      } else if (mode === 'list') {
        // Cuando vuelve a lista, recargar los incidentes del filtro seleccionado
        this.loadIncidents();
      }
    });
  }

  ngOnInit() {
    this.loadStatusCounts();
    this.loadIncidents();
    this.loadLeaflet();
    
    // Detectar si hay un incidentId en los query params
    this.route.queryParams.subscribe(params => {
      const incidentId = params['incidentId'];
      if (incidentId) {
        // Esperar a que se carguen los incidentes y luego seleccionar el específico
        setTimeout(() => {
          const incident = this.incidents().find(i => i.id === parseInt(incidentId, 10));
          if (incident) {
            this.selectIncident(incident);
          }
        }, 500);
      }
    });
  }

  loadStatusCounts() {
    // Cargar conteos de todos los estados en paralelo
    const estados = ['pendiente', 'asignado', 'en_proceso', 'resuelto'];
    const requests = estados.map(estado => {
      const url = estado === 'pendiente' 
        ? `${this.apiUrl}/pendientes/asignacion`
        : `${this.apiUrl}?estado=${estado}`;
      return this.http.get<ApiResponse>(url);
    });

    // Ejecutar todas las peticiones en paralelo
    Promise.all(requests.map(req => req.toPromise()))
      .then(responses => {
        const counts = {
          pendiente: responses[0]?.data.length || 0,
          asignado: responses[1]?.data.length || 0,
          en_proceso: responses[2]?.data.length || 0,
          resuelto: responses[3]?.data.length || 0,
          total: 0
        };
        counts.total = counts.pendiente + counts.asignado + counts.en_proceso + counts.resuelto;
        this.statusCounts.set(counts);
      })
      .catch(err => {
        console.error('Error loading status counts:', err);
      });
  }

  async loadLeaflet() {
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
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    this.L = (window as any).L;
  }

  loadIncidents() {
    this.loading.set(true);
    this.error.set(null);

    const filter = this.selectedFilter();
    
    if (filter === 'todos') {
      // Cargar todos los incidentes
      const pendientesRequest = this.http.get<ApiResponse>(`${this.apiUrl}/pendientes/asignacion`);
      const asignadosRequest = this.http.get<ApiResponse>(`${this.apiUrl}?estado=asignado`);
      const enProcesoRequest = this.http.get<ApiResponse>(`${this.apiUrl}?estado=en_proceso`);
      const resueltosRequest = this.http.get<ApiResponse>(`${this.apiUrl}?estado=resuelto`);
      
      Promise.all([
        pendientesRequest.toPromise(),
        asignadosRequest.toPromise(),
        enProcesoRequest.toPromise(),
        resueltosRequest.toPromise()
      ]).then(responses => {
        const allIncidents = [
          ...(responses[0]?.data || []),
          ...(responses[1]?.data || []),
          ...(responses[2]?.data || []),
          ...(responses[3]?.data || [])
        ];
        this.incidents.set(allIncidents);
        this.loading.set(false);
      }).catch(err => {
        console.error('Error loading all incidents:', err);
        this.error.set('Error al cargar las solicitudes');
        this.loading.set(false);
      });
    } else {
      // Cargar solo el filtro seleccionado
      let url: string;
      if (filter === 'pendiente') {
        url = `${this.apiUrl}/pendientes/asignacion`;
      } else {
        url = `${this.apiUrl}?estado=${filter}`;
      }

      this.http.get<ApiResponse>(url).subscribe({
        next: (response) => {
          this.incidents.set(response.data);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading incidents:', err);
          this.error.set(err.error?.message || 'Error al cargar las solicitudes');
          this.loading.set(false);
        }
      });
    }
  }

  loadAllIncidentsForMap() {
    // Cargar todos los incidentes para mostrar en el mapa
    console.log('Loading all incidents for map view');
    
    const pendientesRequest = this.http.get<ApiResponse>(`${this.apiUrl}/pendientes/asignacion`);
    const asignadosRequest = this.http.get<ApiResponse>(`${this.apiUrl}?estado=asignado`);
    const enProcesoRequest = this.http.get<ApiResponse>(`${this.apiUrl}?estado=en_proceso`);
    const resueltosRequest = this.http.get<ApiResponse>(`${this.apiUrl}?estado=resuelto`);
    
    // Cargar todos en paralelo
    Promise.all([
      pendientesRequest.toPromise(),
      asignadosRequest.toPromise(),
      enProcesoRequest.toPromise(),
      resueltosRequest.toPromise()
    ]).then(responses => {
      // Combinar todos los incidentes
      const allIncidents = [
        ...(responses[0]?.data || []),
        ...(responses[1]?.data || []),
        ...(responses[2]?.data || []),
        ...(responses[3]?.data || [])
      ];
      
      console.log('All incidents loaded for map:', allIncidents.length);
      this.incidents.set(allIncidents);
      
      // Actualizar marcadores si estamos en vista de mapa
      if (this.viewMode() === 'map') {
        setTimeout(() => {
          if (this.map) {
            console.log('Updating map markers after loading all incidents');
            this.updateMapMarkers();
          }
        }, 100);
      }
    }).catch(err => {
      console.error('Error loading all incidents for map:', err);
      this.error.set('Error al cargar los incidentes para el mapa');
    });
  }

  filterIncidents(filter: string) {
    this.selectedFilter.set(filter);
    this.selectedIncident.set(null);
    
    // Si estamos en vista de mapa, actualizar el mapa con el filtro
    if (this.viewMode() === 'map') {
      this.loadIncidentsForMap();
    } else {
      this.loadIncidents();
    }
  }
  
  loadIncidentsForMap() {
    // Cargar incidentes según el filtro seleccionado para el mapa
    const filter = this.selectedFilter();
    console.log('Loading incidents for map with filter:', filter);
    
    if (filter === 'todos') {
      // Cargar todos los incidentes
      this.loadAllIncidentsForMap();
    } else {
      // Cargar solo el filtro seleccionado
      let url: string;
      if (filter === 'pendiente') {
        url = `${this.apiUrl}/pendientes/asignacion`;
      } else {
        url = `${this.apiUrl}?estado=${filter}`;
      }
      
      this.http.get<ApiResponse>(url).subscribe({
        next: (response) => {
          console.log('Filtered incidents loaded for map:', response.data.length);
          this.incidents.set(response.data);
          
          // Actualizar marcadores
          setTimeout(() => {
            if (this.map) {
              this.updateMapMarkers();
            }
          }, 100);
        },
        error: (err) => {
          console.error('Error loading filtered incidents for map:', err);
          this.error.set('Error al cargar los incidentes para el mapa');
        }
      });
    }
  }

  selectIncident(incident: Incident) {
    this.loadingDetail.set(true);
    this.selectedIncident.set(null);
    
    // Cargar el detalle completo del incidente
    this.http.get<ApiDetailResponse>(`${this.apiUrl}/${incident.id}`).subscribe({
      next: (response) => {
        this.selectedIncident.set(response.data);
        this.loadingDetail.set(false);
        if (this.viewMode() === 'map') {
          this.centerMapOnIncident(incident);
        }
      },
      error: (err) => {
        console.error('Error loading incident detail:', err);
        this.error.set('Error al cargar el detalle del incidente');
        this.loadingDetail.set(false);
      }
    });
  }

  initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || !this.L) return;

    // Inicializar el mapa sin centro específico
    this.map = this.L.map('map');

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    // Establecer una vista por defecto de Bolivia
    this.map.setView([-16.5, -68.15], 6);

    this.updateMapMarkers();
  }

  updateMapMarkers() {
    if (!this.map || !this.L) return;

    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];

    console.log('Updating map markers. Incidents:', this.incidents().length);

    if (this.incidents().length === 0) return;

    const bounds = this.L.latLngBounds([]);

    this.incidents().forEach(incident => {
      console.log('Processing incident:', incident.id, 'Lat:', incident.latitude, 'Lng:', incident.longitude);
      
      if (!incident.latitude || !incident.longitude) {
        console.warn('Incident missing coordinates:', incident.id);
        return;
      }

      const position: [number, number] = [incident.latitude, incident.longitude];
      const markerColor = this.getMarkerColor(incident.estado_actual);
      
      // Crear icono personalizado estilo Google Maps mejorado
      const pinIcon = this.L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div style="position: relative; width: 32px; height: 45px;">
            <div style="
              position: absolute;
              width: 28px;
              height: 28px;
              background: ${markerColor};
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              top: 0;
              left: 2px;
            "></div>
            <div style="
              position: absolute;
              width: 8px;
              height: 8px;
              background: white;
              border-radius: 50%;
              top: 7px;
              left: 12px;
              z-index: 1;
            "></div>
          </div>
        `,
        iconSize: [32, 45],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
      });
      
      const marker = this.L.marker(position, { icon: pinIcon }).addTo(this.map);

      // Popup con información detallada
      const prioridadBadge = incident.prioridad_ia 
        ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; 
             background: ${this.getPrioridadBgColor(incident.prioridad_ia)}; color: white; margin-right: 4px;">
             ${this.getPrioridadLabel(incident.prioridad_ia)}
           </span>`
        : '';
      
      const categoriaBadge = incident.categoria_ia
        ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; 
             background: #e5e7eb; color: #374151;">
             ${incident.categoria_ia}
           </span>`
        : '';

      marker.bindPopup(`
        <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 16px; color: #111827;">#${incident.id}</strong>
            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
                   background: ${markerColor}; color: white;">
              ${this.getEstadoLabel(incident.estado_actual)}
            </span>
          </div>
          <p style="margin: 8px 0; color: #374151; font-size: 14px; line-height: 1.5;">
            ${this.truncate(incident.descripcion, 100)}
          </p>
          ${prioridadBadge || categoriaBadge ? `
            <div style="margin: 8px 0;">
              ${prioridadBadge}
              ${categoriaBadge}
            </div>
          ` : ''}
          ${incident.direccion_referencia ? `
            <div style="display: flex; align-items: start; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                ${this.truncate(incident.direccion_referencia, 60)}
              </span>
            </div>
          ` : ''}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <span style="font-size: 11px; color: #9ca3af;">
              ${this.formatDate(incident.created_at)}
            </span>
          </div>
          <button onclick="document.dispatchEvent(new CustomEvent('selectIncident', {detail: ${incident.id}}))"
                  style="width: 100%; margin-top: 10px; padding: 8px; background: #ea580c; color: white; 
                         border: none; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">
            Ver Detalles
          </button>
        </div>
      `, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      marker.on('click', () => {
        this.selectIncident(incident);
      });

      this.markers.push(marker);
      bounds.extend(position);
    });

    console.log('Total markers added:', this.markers.length);

    if (this.markers.length > 0) {
      // Ajustar el mapa para mostrar todos los marcadores
      this.map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 15 
      });
    } else if (this.incidents().length > 0) {
      // Si hay incidentes pero no marcadores (sin coordenadas), centrar en Bolivia
      this.map.setView([-16.5, -68.15], 6);
    }
  }

  getPrioridadBgColor(prioridad: string): string {
    const colors: Record<string, string> = {
      'alta': '#dc2626',
      'media': '#f59e0b',
      'baja': '#3b82f6'
    };
    return colors[prioridad] || '#6b7280';
  }

  openImageModal(imageUrl: string) {
    this.selectedImage.set(imageUrl);
  }

  closeImageModal() {
    this.selectedImage.set(null);
  }

  centerMapOnIncident(incident: Incident) {
    if (!this.map) return;
    const position: [number, number] = [incident.latitude, incident.longitude];
    this.map.setView(position, 15);
  }

  initMiniMap(incident: Incident) {
    const mapElement = document.getElementById(`mini-map-${incident.id}`);
    if (!mapElement || !this.L) return;

    const position: [number, number] = [incident.latitude, incident.longitude];

    const miniMap = this.L.map(`mini-map-${incident.id}`, {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false
    }).setView(position, 14);

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(miniMap);

    this.L.circleMarker(position, {
      radius: 8,
      fillColor: '#ea580c',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(miniMap);
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

  truncate(text: string, length: number): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  getEstadoLabel(estado: string): string {
    const labels: Record<string, string> = {
      'pendiente': 'Pendiente',
      'asignado': 'Asignado',
      'en_proceso': 'En Proceso',
      'resuelto': 'Resuelto',
      'cancelado': 'Cancelado'
    };
    return labels[estado] || estado;
  }

  getEstadoColor(estado: string): string {
    const colors: Record<string, string> = {
      'pendiente': 'warning',
      'asignado': 'info',
      'en_proceso': 'primary',
      'resuelto': 'success',
      'cancelado': 'secondary'
    };
    return colors[estado] || 'secondary';
  }

  getPrioridadLabel(prioridad: string): string {
    const labels: Record<string, string> = {
      'alta': 'Alta',
      'media': 'Media',
      'baja': 'Baja'
    };
    return labels[prioridad] || prioridad;
  }

  getPrioridadColor(prioridad: string): string {
    const colors: Record<string, string> = {
      'alta': 'danger',
      'media': 'warning',
      'baja': 'info'
    };
    return colors[prioridad] || 'secondary';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short'
    });
  }

  formatFullDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  acceptIncident(incident: Incident) {
    if (this.isProcessing()) return;

    this.isProcessing.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post<ApiResponse>(`${this.apiUrl}/${incident.id}/aceptar`, {}).subscribe({
      next: (response) => {
        this.success.set('Solicitud aceptada exitosamente');
        this.selectedIncident.set(null);
        this.loadStatusCounts(); // Actualizar contadores
        this.loadIncidents();
        this.isProcessing.set(false);
        
        // Clear success message after 5 seconds
        setTimeout(() => this.success.set(null), 5000);
      },
      error: (err) => {
        console.error('Error accepting incident:', err);
        this.error.set(err.error?.message || 'Error al aceptar la solicitud');
        this.isProcessing.set(false);
      }
    });
  }

  openRejectModal(incident: Incident) {
    this.selectedIncident.set(incident);
    this.showRejectModal.set(true);
    this.rejectReason.set('');
  }

  closeRejectModal() {
    this.showRejectModal.set(false);
    this.rejectReason.set('');
  }

  rejectIncident() {
    const incident = this.selectedIncident();
    if (!incident || this.isProcessing()) return;

    const reason = this.rejectReason().trim();
    if (reason.length < 10) {
      this.error.set('El motivo debe tener al menos 10 caracteres');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post<ApiResponse>(`${this.apiUrl}/${incident.id}/rechazar`, { motivo: reason }).subscribe({
      next: (response) => {
        this.success.set('Solicitud rechazada. El sistema buscará otro taller.');
        this.closeRejectModal();
        this.selectedIncident.set(null);
        this.loadStatusCounts(); // Actualizar contadores
        this.loadIncidents();
        this.isProcessing.set(false);
        
        // Clear success message after 5 seconds
        setTimeout(() => this.success.set(null), 5000);
      },
      error: (err) => {
        console.error('Error rejecting incident:', err);
        this.error.set(err.error?.message || 'Error al rechazar la solicitud');
        this.isProcessing.set(false);
      }
    });
  }
}
