import { Component, OnInit, OnDestroy, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  IncidentsService,
  type IncidentAiAnalysis,
  type Incident as ServiceIncident,
} from '../../../core/services/incidents.service';

interface TechnicianBasicInfo {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface WorkshopBasicInfo {
  id: number;
  workshop_name: string;
  phone: string | null;
}

interface SuggestedTechnicianInfo {
  technician_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  final_score: number;
  distance_km: number;
  ai_reasoning: string | null;
  assignment_strategy: string;
  status?: string; // pending, timeout, rejected, accepted
  timeout_at?: string; // Timestamp cuando expira el timeout
}

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
  taller_id: number | null;
  tecnico_id: number | null;
  technician: TechnicianBasicInfo | null;
  workshop: WorkshopBasicInfo | null;
  suggested_technician?: SuggestedTechnicianInfo | null;  // Opcional
  // Campos calculados localmente
  _isTimedOut?: boolean;
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
export class IncidentsListComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly incidentsService = inject(IncidentsService);
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
  showAcceptModal = signal(false);
  showAssignTechnicianModal = signal(false);
  acceptWithSuggestedTechnician = signal(false);
  rejectReason = signal('');
  availableTechnicians = signal<any[]>([]);
  selectedTechnicianId = signal<number | null>(null);
  loadingTechnicians = signal(false);
  isProcessing = signal(false);
  selectedImage = signal<string | null>(null);
  showLegend = signal(false);
  latestAiAnalysis = signal<IncidentAiAnalysis | null>(null);
  aiLoading = signal(false);
  
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
  private timeoutCheckInterval: any = null;

  readonly filteredIncidents = computed(() => {
    const filter = this.selectedFilter();
    const allIncidents = this.incidents();
    
    if (filter === 'todos') {
      return allIncidents;
    }
    
    if (filter === 'pendiente') {
      // Los incidentes pendientes pueden venir del endpoint /pendientes/asignacion
      // que incluye incidentes con estado 'pendiente' o que están esperando asignación
      return allIncidents.filter(incident => 
        incident.estado_actual === 'pendiente' || 
        (incident.estado_actual === 'pendiente' && !incident.taller_id)
      );
    }
    
    return allIncidents.filter(incident => incident.estado_actual === filter);
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
        
        setTimeout(() => {
          // Siempre destruir y recrear el mapa para evitar problemas de DOM
          if (this.map) {
            this.destroyMap();
          }
          
          // Cargar incidentes según el filtro seleccionado
          this.loadIncidentsForMap();
          
          // Inicializar el mapa
          this.initMap();
        }, 150);
      } else if (mode === 'list' && this.map) {
        // Destruir el mapa cuando se cambia a vista de lista
        this.destroyMap();
        // Cuando vuelve a lista, recargar los incidentes del filtro seleccionado
        this.loadIncidents();
      }
    });

    // ✅ Suscribirse al servicio reactivo de incidentes
    this.incidentsService.incidents$.subscribe(incidents => {
      // Convertir los incidentes del servicio al formato local
      const localIncidents: Incident[] = incidents.map(inc => ({
        id: inc.id,
        descripcion: inc.descripcion,
        estado_actual: inc.estado_actual,
        prioridad_ia: inc.prioridad_ia,
        categoria_ia: inc.categoria_ia,
        created_at: inc.created_at,
        direccion_referencia: inc.direccion_referencia,
        latitude: inc.latitud,
        longitude: inc.longitud,
        client_id: inc.cliente_id,
        vehiculo_id: inc.vehiculo_id,
        taller_id: inc.taller_id,
        tecnico_id: inc.tecnico_id,
        technician: null,
        workshop: null,
        suggested_technician: null,
        suggested_technicians: [],
        ai_analysis: null
      }));
      this.incidents.set(localIncidents);
      console.log('✅ Incidents updated from service:', incidents.length);
    });

    this.incidentsService.loading$.subscribe(loading => {
      this.loading.set(loading);
    });

    // ✅ Recargar contadores cuando llega un nuevo incidente asignado
    this.incidentsService.incidentAssigned$.subscribe(() => {
      this.loadStatusCounts();
    });
  }

  ngOnInit() {
    this.loadStatusCounts();
    this.loadIncidents();
    this.loadLeaflet();
    this.connectWebSocket(); // ✅ Conectar WebSocket
    this.startTimeoutChecker(); // ✅ Iniciar verificador de timeouts
    
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

  ngOnDestroy(): void {
    this.destroyMap();
    this.stopTimeoutChecker(); // ✅ Detener verificador de timeouts
    // this.wsService.disconnect(); // ✅ Desconectar WebSocket
  }

  /**
   * ✅ Conectar WebSocket para recibir actualizaciones en tiempo real
   */
  connectWebSocket(): void {
    // if (!this.wsService.isConnected()) {
    //   this.wsService.connect();
    // }
    console.log('✅ WebSocket connected for incidents list');
  }

  destroyMap(): void {
    if (this.map) {
      // Limpiar todos los marcadores
      this.markers.forEach(marker => {
        if (this.map && this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      });
      this.markers = [];
      
      // Remover el mapa completamente
      this.map.remove();
      this.map = null;
      
      // Limpiar el contenedor del DOM
      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        mapContainer.innerHTML = '';
        // Remover clases de Leaflet que puedan quedar
        mapContainer.className = 'map';
      }
    }
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
    // ✅ Cargar todos los incidentes para filtrado local
    this.loading.set(true);
    this.error.set(null);
    
    // Cargar todos los estados en paralelo
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
      // Combinar todos los incidentes
      const allIncidents = [
        ...(responses[0]?.data || []),
        ...(responses[1]?.data || []),
        ...(responses[2]?.data || []),
        ...(responses[3]?.data || [])
      ];
      
      console.log('✅ All incidents loaded for filtering:', allIncidents.length);
      this.incidents.set(allIncidents);
      this.loading.set(false);
    }).catch(err => {
      console.error('Error loading incidents:', err);
      this.error.set('Error al cargar los incidentes');
      this.loading.set(false);
    });
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
    }
    // En vista de lista, el filtrado se hace automáticamente con el computed filteredIncidents
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
    this.clearAiAnalysisState();
    
    // Cargar el detalle completo del incidente
    this.http.get<ApiDetailResponse>(`${this.apiUrl}/${incident.id}`).subscribe({
      next: (response) => {
        this.selectedIncident.set(response.data);
        this.loadingDetail.set(false);
        this.loadIncidentAiAnalysisData(incident.id);
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

  clearAiAnalysisState() {
    this.latestAiAnalysis.set(null);
    this.aiLoading.set(false);
  }

  loadIncidentAiAnalysisData(incidentId: number) {
    this.aiLoading.set(true);

    this.incidentsService.getLatestIncidentAiAnalysis(incidentId).subscribe({
      next: (analysis) => {
        this.latestAiAnalysis.set(analysis);
        this.aiLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status !== 404 && err.status !== 403) {
          console.error('Error loading latest incident AI analysis:', err);
        }
        this.latestAiAnalysis.set(null);
        this.aiLoading.set(false);
      }
    });
  }

  refreshIncidentAiAnalysisData() {
    const incident = this.selectedIncident();
    if (!incident || this.aiLoading()) {
      return;
    }

    this.loadIncidentAiAnalysisData(incident.id);
  }

  formatAiConfidence(confidence: number | null): string {
    if (confidence === null || Number.isNaN(confidence)) {
      return 'N/D';
    }

    const normalizedConfidence = Math.max(0, Math.min(1, confidence));
    return `${Math.round(normalizedConfidence * 100)}%`;
  }

  getVisibleAiItems(items: string[] | null | undefined, maxItems = 6): string[] {
    return (items ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, maxItems);
  }

  getAiStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      processing: 'Procesando',
      completed: 'Completado',
      failed: 'Fallido'
    };
    return labels[status] || status;
  }

  getAiStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'warning',
      processing: 'primary',
      completed: 'success',
      failed: 'danger'
    };
    return colors[status] || 'secondary';
  }

  initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || !this.L) {
      console.error('❌ Map element or Leaflet not available');
      return;
    }

    // Asegurar que el contenedor esté limpio y tenga el tamaño correcto
    mapElement.innerHTML = '';
    mapElement.className = 'map';
    mapElement.style.width = '100%';
    mapElement.style.height = '100%';
    mapElement.style.maxWidth = '100%';
    mapElement.style.boxSizing = 'border-box';

    try {
      // Crear el mapa con configuración profesional
      this.map = this.L.map('map', {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true // Mejor rendimiento
      });

      // Agregar controles personalizados
      this.L.control.zoom({
        position: 'topright'
      }).addTo(this.map);

      // Agregar múltiples capas de mapa
      const osmLayer = this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });

      const satelliteLayer = this.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19,
      });

      const terrainLayer = this.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
        maxZoom: 17,
      });

      // Agregar capa por defecto
      osmLayer.addTo(this.map);

      // Control de capas
      const baseLayers = {
        "Mapa": osmLayer,
        "Satélite": satelliteLayer,
        "Terreno": terrainLayer
      };

      this.L.control.layers(baseLayers, null, {
        position: 'topright'
      }).addTo(this.map);

      // Centrar en Bolivia por defecto
      this.map.setView([-16.5, -68.15], 6);

      // Forzar que el mapa se ajuste al contenedor
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 100);

      // Actualizar marcadores
      this.updateMapMarkers();

      console.log('✅ Map initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
      this.map = null;
    }
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
          <div class="pin-wrapper">
            <div class="pin-container" style="
              position: relative;
              width: 40px;
              height: 50px;
              filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
            ">
              <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Pin principal -->
                <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34c0-8.837-7.163-16-16-16z" 
                      fill="${markerColor}"/>
                <!-- Borde blanco -->
                <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" 
                      fill="white" opacity="0.3"/>
                <!-- Círculo interior -->
                <circle cx="20" cy="16" r="8" fill="white"/>
                <!-- Número del incidente -->
                <text x="20" y="20" text-anchor="middle" font-size="8" font-weight="bold" fill="${markerColor}">
                  ${incident.id}
                </text>
              </svg>
            </div>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
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

  toggleLegend() {
    this.showLegend.set(!this.showLegend());
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

  openAcceptModal(incident: Incident) {
    // Usar el incidente de la lista actual en lugar del parámetro
    const currentIncident = this.incidents().find(i => i.id === incident.id);
    if (currentIncident) {
      this.selectedIncident.set(currentIncident);
    } else {
      this.selectedIncident.set(incident);
    }
    
    this.showAcceptModal.set(true);
    this.acceptWithSuggestedTechnician.set(false);
  }

  closeAcceptModal() {
    this.showAcceptModal.set(false);
    this.acceptWithSuggestedTechnician.set(false);
  }

  acceptIncident() {
    const incident = this.selectedIncident();
    if (!incident || this.isProcessing()) return;

    this.isProcessing.set(true);
    this.error.set(null);
    this.success.set(null);

    const acceptWithTechnician = this.acceptWithSuggestedTechnician();

    this.http.post<ApiResponse>(`${this.apiUrl}/${incident.id}/aceptar`, {
      accept_suggested_technician: acceptWithTechnician
    }).subscribe({
      next: (response) => {
        const message = acceptWithTechnician 
          ? 'Solicitud aceptada con técnico asignado. El incidente está en proceso.'
          : 'Solicitud aceptada. Ahora puedes asignar un técnico manualmente.';
        this.success.set(message);
        this.closeAcceptModal();
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

  openAssignTechnicianModal(incident: IncidentDetail) {
    this.selectedIncident.set(incident);
    this.showAssignTechnicianModal.set(true);
    this.selectedTechnicianId.set(null);
    this.loadAvailableTechnicians(incident.taller_id!);
  }

  closeAssignTechnicianModal() {
    this.showAssignTechnicianModal.set(false);
    this.selectedTechnicianId.set(null);
    this.availableTechnicians.set([]);
  }

  loadAvailableTechnicians(workshopId: number) {
    this.loadingTechnicians.set(true);
    
    this.http.get<any>(`${environment.apiUrl}/technicians/workshops/${workshopId}/available`).subscribe({
      next: (response) => {
        this.availableTechnicians.set(response.data.technicians || []);
        this.loadingTechnicians.set(false);
      },
      error: (err) => {
        console.error('Error loading technicians:', err);
        this.error.set('Error al cargar los técnicos disponibles');
        this.loadingTechnicians.set(false);
      }
    });
  }

  assignTechnician() {
    const incident = this.selectedIncident();
    const technicianId = this.selectedTechnicianId();
    
    if (!incident || !technicianId || this.isProcessing()) return;

    this.isProcessing.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post<any>(`${environment.apiUrl}/real-time/incidents/${incident.id}/assign`, {
      technician_id: technicianId
    }).subscribe({
      next: (response) => {
        this.success.set('Técnico asignado exitosamente. El incidente está en proceso.');
        this.closeAssignTechnicianModal();
        this.selectedIncident.set(null);
        this.loadStatusCounts();
        this.loadIncidents();
        this.isProcessing.set(false);
        
        setTimeout(() => this.success.set(null), 5000);
      },
      error: (err) => {
        console.error('Error assigning technician:', err);
        this.error.set(err.error?.detail || err.error?.message || 'Error al asignar el técnico');
        this.isProcessing.set(false);
      }
    });
  }

  openTrackingView(incident: IncidentDetail) {
    // Navegar a la vista de seguimiento con mapa completo y chat
    this.router.navigate(['/tracking/incident', incident.id]);
  }

  /**
   * ✅ Iniciar verificador de timeouts
   * Verifica cada segundo si algún incidente pendiente ha excedido el tiempo de respuesta
   */
  startTimeoutChecker() {
    // Verificar inmediatamente
    this.checkTimeouts();
    
    // Luego verificar cada segundo
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts();
    }, 1000);
  }

  /**
   * ✅ Detener verificador de timeouts
   */
  stopTimeoutChecker() {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }

  /**
   * ✅ Verificar timeouts de incidentes pendientes
   * Verifica si los incidentes han excedido el tiempo de respuesta
   */
  checkTimeouts() {
    const currentIncidents = this.incidents();
    let hasChanges = false;

    const updatedIncidents = currentIncidents.map(incident => {
      // Solo verificar incidentes pendientes con técnico sugerido que tenga timeout_at
      if (incident.estado_actual === 'pendiente' && 
          incident.suggested_technician && 
          incident.suggested_technician.timeout_at) {
        
        const timeoutAt = new Date(incident.suggested_technician.timeout_at);
        const now = new Date();
        
        // Marcar como timeout si el tiempo se acabó
        const wasTimedOut = incident._isTimedOut || false;
        const isTimedOut = now.getTime() >= timeoutAt.getTime();

        // Log para debugging
        if (incident.id === 47 || incident.id === 31) {
          console.log(`🔍 Incident #${incident.id}:`, {
            timeout_at: incident.suggested_technician.timeout_at,
            isTimedOut,
            wasTimedOut
          });
        }

        if (isTimedOut !== wasTimedOut) {
          hasChanges = true;
          console.log(`⚠️ Incident #${incident.id} timeout status changed: ${wasTimedOut} → ${isTimedOut}`);
        }

        return {
          ...incident,
          _isTimedOut: isTimedOut
        };
      }

      return incident;
    });

    // Solo actualizar si hay cambios en el estado de timeout
    if (hasChanges) {
      this.incidents.set(updatedIncidents);
    }
  }

  /**
   * ✅ Verificar si un incidente está en timeout
   */
  isIncidentTimedOut(incident: Incident): boolean {
    return incident._isTimedOut === true;
  }

}

