import { Component, OnInit, OnDestroy, inject, signal, effect, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  IncidentsService,
  type IncidentAiAnalysis,
} from '../../../core/services/incidents.service';
import {
  Incident,
  IncidentPriority,
  IncidentStatus,
  PriorityColors,
  StatusColors,
  Client,
  Vehicle,
  Category,
  SuggestedTechnician as ModelSuggestedTechnician,
  Evidence,
  ImageEvidence,
  AudioEvidence,
  AIAnalysis,
} from '../../../core/models/incident.model';
import { IncidentCardComponent } from './components/incident-card/incident-card.component';
import { sortIncidents } from '../../../core/utils/incident-list.utils';

/** API raw response fields (as returned by backend) */
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
  resumen_ia: string | null;
  es_ambiguo: boolean;
  estado_actual: string;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  technician?: ApiTechnicianRaw | null;
  workshop?: ApiWorkshopRaw | null;
  suggested_technician?: ApiSuggestedTechRaw | null;
  evidencias?: ApiEvidenciaRaw[];
  imagenes?: ApiImagenRaw[];
  audios?: ApiAudioRaw[];
}

interface ApiTechnicianRaw {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface ApiWorkshopRaw {
  id: number;
  workshop_name: string;
  phone: string | null;
}

interface ApiSuggestedTechRaw {
  technician_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  final_score: number;
  distance_km: number;
  ai_reasoning: string | null;
  assignment_strategy: string;
  status?: string;
  timeout_at?: string;
}

interface ApiEvidenciaRaw {
  id: number;
  tipo: string;
  descripcion: string;
  created_at: string;
}

interface ApiImagenRaw {
  id: number;
  file_url: string;
  file_name: string;
  created_at: string;
}

interface ApiAudioRaw {
  id: number;
  file_url: string;
  file_name: string;
  created_at: string;
}

/** Unified type with the model Incident shape plus backward-compat aliases */
type UnifiedIncident = Incident & {
  _isTimedOut?: boolean;
  estado_actual: IncidentStatus;
  prioridad_ia: string | null;
  categoria_ia: string | null;
  latitude: number | null;
  longitude: number | null;
  client_id: number;
  technician: ApiTechnicianRaw | null;
  workshop: ApiWorkshopRaw | null;
  suggested_technician_info?: ApiSuggestedTechRaw | null;
  evidencias?: any[];
  imagenes?: any[];
  audios?: any[];
};

interface IncidentDetail {
  id: number;
  descripcion: string;
  estado_actual: IncidentStatus;
  prioridad_ia: string | null;
  categoria_ia: string | null;
  created_at: string;
  direccion_referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  client_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  technician: ApiTechnicianRaw | null;
  workshop: ApiWorkshopRaw | null;
  suggested_technician: ModelSuggestedTechnician | null;
  suggested_technician_info?: ApiSuggestedTechRaw | null;
  _isTimedOut?: boolean;
  evidencias?: ApiEvidenciaRaw[];
  imagenes?: ApiImagenRaw[];
  audios?: ApiAudioRaw[];
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
  data: ApiIncidentRaw[];
  message: string;
}

interface ApiDetailResponse {
  success: boolean;
  data: ApiIncidentRaw;
  message: string;
}

/**
 * Adapter: converts raw API response to unified Incident model.
 * Ensures parity between API-fetched and WebSocket-arriving data.
 */
function mapApiToIncident(raw: ApiIncidentRaw): UnifiedIncident {
  const prioridad = mapBackendPriority(raw.prioridad_ia);
  const estado = mapBackendStatus(raw.estado_actual);

  // Map suggested_technician if present
  let suggested: ModelSuggestedTechnician | null = null;
  if (raw.suggested_technician) {
    suggested = {
      technician_id: raw.suggested_technician.technician_id,
      technician_name: `${raw.suggested_technician.first_name} ${raw.suggested_technician.last_name}`,
      distance_km: raw.suggested_technician.distance_km,
      compatibility_score: raw.suggested_technician.final_score,
      timeout_at: raw.suggested_technician.timeout_at || '',
      assigned_at: raw.assigned_at || raw.created_at,
    };
  }

  // Build categoria object from string
  const categoria: Category | undefined = raw.categoria_ia
    ? { id: 0, nombre: raw.categoria_ia, descripcion: '', icono: null }
    : undefined;

  return {
    // Model Incident fields
    id: raw.id,
    descripcion: raw.descripcion,
    prioridad,
    estado,
    cliente_id: raw.client_id,
    vehiculo_id: raw.vehiculo_id,
    categoria_id: 0,
    categoria,
    taller_id: raw.taller_id,
    tecnico_id: raw.tecnico_id,
    ubicacion: raw.direccion_referencia,
    latitud: raw.latitude,
    longitud: raw.longitude,
    direccion_referencia: raw.direccion_referencia,
    suggested_technician: suggested,
    rejection_count: 0,
    has_timeout: false,
    timeout_at: null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    // Legacy aliases (only fields NOT already in model Incident)
    _isTimedOut: false,
    estado_actual: estado,
    prioridad_ia: raw.prioridad_ia,
    categoria_ia: raw.categoria_ia,
    latitude: raw.latitude,
    longitude: raw.longitude,
    client_id: raw.client_id,
    technician: raw.technician || null,
    workshop: raw.workshop || null,
    suggested_technician_info: raw.suggested_technician || null,
    evidencias: raw.evidencias as any,
    imagenes: raw.imagenes as any,
    audios: raw.audios as any,
  } as unknown as UnifiedIncident;
}

function mapBackendPriority(prioridadIa: string | null): IncidentPriority {
  if (!prioridadIa) return 'media';
  const lower = prioridadIa.toLowerCase();
  if (lower.includes('alta') || lower.includes('high')) return 'alta';
  if (lower.includes('baja') || lower.includes('low')) return 'baja';
  return 'media';
}

function mapBackendStatus(statusRaw: string): IncidentStatus {
  const normalized = String(statusRaw || '').trim().toLowerCase();
  const statusMap: Record<string, IncidentStatus> = {
    'pendiente': 'pendiente',
    'pending': 'pendiente',
    'asignado': 'asignado',
    'assigned': 'asignado',
    'aceptado': 'aceptado',
    'accepted': 'aceptado',
    'en_camino': 'en_camino',
    'on_way': 'en_camino',
    'en_proceso': 'en_proceso',
    'in_progress': 'en_proceso',
    'resuelto': 'resuelto',
    'resolved': 'resuelto',
    'cancelado': 'cancelado',
    'cancelled': 'cancelado',
    'sin_taller_disponible': 'sin_taller_disponible',
    'sin_taller_asignado': 'sin_taller_disponible',
    'sin taller disponible': 'sin_taller_disponible',
    'sin taller asignado': 'sin_taller_disponible',
    'no_workshop_available': 'sin_taller_disponible',
  };
  return statusMap[normalized] || 'pendiente';
}

function mapServiceIncidentToUnified(
  serviceIncident: any,
  existing?: UnifiedIncident
): UnifiedIncident {
  const prioridad = mapBackendPriority(serviceIncident.prioridad_ia || serviceIncident.prioridad_label || null);
  let estado = mapBackendStatus(serviceIncident.estado_actual || serviceIncident.estado || 'pendiente');

  // Preserve sin_taller_disponible: if existing already has it, don't let stale
  // data from concurrent async handlers (e.g. handleAssignmentTimeout HTTP fetch)
  // overwrite back to an earlier state.
  if (existing && existing.estado_actual === 'sin_taller_disponible' && estado !== 'sin_taller_disponible') {
    estado = 'sin_taller_disponible';
  }

  const categoria: Category | undefined = serviceIncident.categoria_ia
    ? { id: 0, nombre: serviceIncident.categoria_ia, descripcion: '', icono: null }
    : existing?.categoria;

  let suggested: ModelSuggestedTechnician | null = existing?.suggested_technician || null;
  let suggestedTechInfo: ApiSuggestedTechRaw | null = existing?.suggested_technician_info || null;
  const resolvedTimeoutAt =
    serviceIncident.timeout_at ||
    serviceIncident.suggested_technician?.timeout_at ||
    serviceIncident.suggested_technician_info?.timeout_at ||
    existing?.suggested_technician?.timeout_at ||
    existing?.suggested_technician_info?.timeout_at ||
    null;

  let derivedTimeoutAt = resolvedTimeoutAt;
  if (!derivedTimeoutAt) {
    const estimatedMinutesRaw =
      serviceIncident.estimated_time ??
      serviceIncident.estimated_time_minutes ??
      serviceIncident.response_timeout_minutes;
    const estimatedMinutes = Number(estimatedMinutesRaw);
    if (Number.isFinite(estimatedMinutes) && estimatedMinutes > 0) {
      derivedTimeoutAt = new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();
    }
  }

  if (serviceIncident.suggested_technician) {
    const nameParts = (serviceIncident.suggested_technician.technician_name || '').split(' ');
    suggested = {
      technician_id: serviceIncident.suggested_technician.technician_id,
      technician_name: serviceIncident.suggested_technician.technician_name || '',
      distance_km: serviceIncident.suggested_technician.distance_km || 0,
      compatibility_score: serviceIncident.suggested_technician.compatibility_score || 0,
      timeout_at: serviceIncident.suggested_technician.timeout_at || derivedTimeoutAt || '',
      assigned_at: serviceIncident.assigned_at || serviceIncident.created_at,
    };
    suggestedTechInfo = {
      technician_id: serviceIncident.suggested_technician.technician_id,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      phone: null,
      final_score: serviceIncident.suggested_technician.compatibility_score || 0,
      distance_km: serviceIncident.suggested_technician.distance_km || 0,
      ai_reasoning: null,
      assignment_strategy: 'ai_assisted',
      timeout_at: serviceIncident.suggested_technician.timeout_at || derivedTimeoutAt || undefined,
    };
  }

  if (!suggested && derivedTimeoutAt) {
    const fallbackTechnicianId =
      serviceIncident.technician_id ??
      existing?.tecnico_id ??
      existing?.suggested_technician?.technician_id ??
      0;

    suggested = {
      technician_id: fallbackTechnicianId,
      technician_name: existing?.suggested_technician?.technician_name || '',
      distance_km: existing?.suggested_technician?.distance_km || 0,
      compatibility_score: existing?.suggested_technician?.compatibility_score || 0,
      timeout_at: derivedTimeoutAt,
      assigned_at: serviceIncident.assigned_at || existing?.suggested_technician?.assigned_at || serviceIncident.created_at,
    };
  }

  const isTimedOut = estado === 'sin_taller_disponible' || !!serviceIncident._isTimedOut;
  const hasTimeout = isTimedOut || !!serviceIncident.has_timeout;

  return {
    id: serviceIncident.id,
    descripcion: serviceIncident.descripcion,
    prioridad,
    estado,
    cliente_id: serviceIncident.cliente_id ?? serviceIncident.client_id ?? existing?.cliente_id ?? 0,
    vehiculo_id: serviceIncident.vehiculo_id ?? existing?.vehiculo_id ?? 0,
    categoria_id: existing?.categoria_id ?? 0,
    categoria,
    taller_id: serviceIncident.taller_id ?? null,
    tecnico_id: serviceIncident.tecnico_id ?? null,
    taller: existing?.taller,
    tecnico: existing?.tecnico,
    ubicacion: serviceIncident.direccion_referencia ?? existing?.ubicacion ?? null,
    latitud: serviceIncident.latitud ?? serviceIncident.latitude ?? existing?.latitud ?? null,
    longitud: serviceIncident.longitud ?? serviceIncident.longitude ?? existing?.longitud ?? null,
    direccion_referencia: serviceIncident.direccion_referencia ?? existing?.direccion_referencia ?? null,
    suggested_technician: suggested,
    rejection_count: existing?.rejection_count || 0,
    has_timeout: hasTimeout,
    timeout_at: derivedTimeoutAt ?? suggested?.timeout_at ?? null,
    created_at: serviceIncident.created_at,
    updated_at: serviceIncident.updated_at || serviceIncident.created_at,
    _isTimedOut: isTimedOut,
    estado_actual: estado,
    prioridad_ia: serviceIncident.prioridad_ia ?? null,
    categoria_ia: serviceIncident.categoria_ia ?? null,
    latitude: serviceIncident.latitud ?? serviceIncident.latitude ?? existing?.latitude ?? null,
    longitude: serviceIncident.longitud ?? serviceIncident.longitude ?? existing?.longitude ?? null,
    client_id: serviceIncident.cliente_id ?? serviceIncident.client_id ?? existing?.client_id ?? 0,
    technician: existing?.technician || null,
    workshop: existing?.workshop || null,
    suggested_technician_info: suggestedTechInfo,
    evidencias: existing?.evidencias,
    imagenes: existing?.imagenes,
    audios: existing?.audios,
  } as UnifiedIncident;
}

@Component({
  selector: 'app-incidents-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule, IncidentCardComponent],
  templateUrl: './incidents-list.html',
  styleUrl: './incidents-list.css'
})
export class IncidentsListComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly incidentsService = inject(IncidentsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  // Signals - unified Incident type throughout
  private allIncidents = signal<UnifiedIncident[]>([]);
  incidents = signal<UnifiedIncident[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  selectedFilter = signal<string>('todos');
  selectedIncident = signal<UnifiedIncident | null>(null);
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
  
  // Contadores de estados - derivados de la lista local en vez de HTTP
  readonly statusCounts = computed(() => {
    const incidents = this.allIncidents();
    const getStatus = (incident: UnifiedIncident): string =>
      (incident.estado_actual as string) || (incident as any).estado || 'pendiente';
    const pendiente = incidents.filter(i => getStatus(i) === 'pendiente').length;
    const asignado = incidents.filter(i => getStatus(i) === 'asignado').length;
    const en_proceso = incidents.filter(i =>
      ['aceptado', 'en_camino', 'en_proceso'].includes(getStatus(i))
    ).length;
    const resuelto = incidents.filter(i => getStatus(i) === 'resuelto').length;
    return {
      pendiente,
      asignado,
      en_proceso,
      resuelto,
      total: pendiente + asignado + en_proceso + resuelto
    };
  });

  private map: any = null;
  private markers: any[] = [];
  private L: any = null;
  private readonly serviceManagedIncidentIds = new Set<number>();

  readonly filteredIncidents = computed(() => {
    const filter = this.selectedFilter();
    const getStatus = (incident: UnifiedIncident): string =>
      (incident.estado_actual as string) || (incident as any).estado || 'pendiente';
    // Talleres NO deben seguir viendo incidentes sin_taller_disponible
    const allIncidents = this.allIncidents().filter(
      incident => getStatus(incident) !== 'sin_taller_disponible'
    );
    
    console.log('🔍 Filtering incidents:', {
      filter,
      total: allIncidents.length,
      incidents: allIncidents.map(i => ({ id: i.id, estado: i.estado_actual, taller_id: i.taller_id }))
    });
    
    if (filter === 'todos') {
      return allIncidents;
    }
    
    if (filter === 'pendiente') {
      const filtered = allIncidents.filter(incident => 
        getStatus(incident) === 'pendiente' || 
        (getStatus(incident) === 'pendiente' && !incident.taller_id)
      );
      console.log('✅ Filter "pendiente" - filtered:', {
        count: filtered.length,
        ids: filtered.map(i => i.id)
      });
      return filtered;
    }
    
    const filtered = allIncidents.filter(incident => getStatus(incident) === filter);
    console.log('✅ Filter result:', {
      filter,
      count: filtered.length,
      ids: filtered.map(i => i.id)
    });
    return filtered;
  });

  readonly incidentsByStatus = computed(() => {
    return this.statusCounts();
  });

  // Computed signal for virtual scroll item size based on screen size
  readonly virtualScrollItemSize = computed(() => {
    // Check if we're on mobile (this is a simple approximation)
    return window.innerWidth <= 768 ? 160 : 180;
  });

  // Track by function for virtual scroll performance
  trackByIncidentId(index: number, incident: UnifiedIncident): number {
    return incident.id;
  }

  constructor() {
    // ✅ Effect para aplicar filtro automáticamente cuando cambie
    effect(() => {
      const filtered = this.filteredIncidents();
      this.incidents.set(filtered);
      
      console.log('✅ Auto-filter applied:', {
        filter: this.selectedFilter(),
        total: this.allIncidents().length,
        filtered: filtered.length
      });
    });

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

    // Fuente única realtime: IncidentsService.
    // Merge incremental para no perder incidentes cargados por HTTP inicial.
    this.incidentsService.incidents$.subscribe(serviceIncidents => {
      const currentAll = this.allIncidents();
      const currentMap = new Map(currentAll.map(incident => [incident.id, incident]));
      const incomingIds = new Set<number>();

      for (const serviceIncident of serviceIncidents) {
        const normalized = mapServiceIncidentToUnified(
          serviceIncident,
          currentMap.get(serviceIncident.id)
        );
        currentMap.set(normalized.id, normalized);
        incomingIds.add(normalized.id);
        this.serviceManagedIncidentIds.add(normalized.id);
      }

      // Solo eliminar IDs que fueron previamente gestionados por realtime.
      for (const managedId of Array.from(this.serviceManagedIncidentIds)) {
        if (!incomingIds.has(managedId)) {
          currentMap.delete(managedId);
          this.serviceManagedIncidentIds.delete(managedId);
        }
      }

      this.allIncidents.set(sortIncidents(Array.from(currentMap.values())));
      
      const filtered = this.filteredIncidents();
      this.incidents.set(filtered);
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
    // ✅ Cargar datos iniciales una sola vez
    this.loadStatusCounts();
    this.loadIncidents();
    this.loadLeaflet();
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
  }

  /**
   * Aplicar el filtro actual a la lista de incidentes visible
   */
  private applyCurrentFilter(): void {
    const filtered = this.filteredIncidents();
    this.incidents.set(filtered);
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
    // ✅ Derived from local allIncidents signal — no HTTP needed
    // statusCounts is a computed signal that auto-recalculates
  }

  async loadLeaflet() {
    try {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.onerror = () => console.warn('Failed to load Leaflet CSS');
        document.head.appendChild(link);
      }

      if (!(window as any).L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          script.onerror = (error) => {
            console.warn('Failed to load Leaflet library:', error);
            reject(error);
          };
          document.head.appendChild(script);
        });
        this.L = (window as any).L;
      }
    } catch (error) {
      console.warn('Leaflet library could not be loaded. Map features will be disabled.', error);
      this.L = null;
    }
  }

  loadIncidents() {
    // ✅ Cargar incidentes del taller actual (backend ya filtra automáticamente)
    this.loading.set(true);
    this.error.set(null);
    
    // ✅ El backend filtra automáticamente por taller cuando el usuario es tipo "workshop"
    // Solo necesitamos hacer requests para los estados que el taller puede ver
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
      // Combine and normalize all incidents through the unified adapter
      const rawIncidents: ApiIncidentRaw[] = [
        ...(responses[0]?.data || []),
        ...(responses[1]?.data || []),
        ...(responses[2]?.data || []),
        ...(responses[3]?.data || [])
      ];
      const unifiedIncidents = rawIncidents.map(r => mapApiToIncident(r)) as UnifiedIncident[];

      console.log('✅ Workshop incidents loaded (backend filtered):', unifiedIncidents.length);

      // Update full list with unified data
      this.allIncidents.set(unifiedIncidents);

      // Apply current filter
      const filtered = this.filteredIncidents();
      this.incidents.set(filtered);

      console.log('✅ Filter applied after load:', {
        total: unifiedIncidents.length,
        filtered: filtered.length,
        filter: this.selectedFilter()
      });

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
      // Combine and normalize
      const rawIncidents: ApiIncidentRaw[] = [
        ...(responses[0]?.data || []),
        ...(responses[1]?.data || []),
        ...(responses[2]?.data || []),
        ...(responses[3]?.data || [])
      ];
      const unifiedIncidents = rawIncidents.map(r => mapApiToIncident(r)) as UnifiedIncident[];

      console.log('All incidents loaded for map:', unifiedIncidents.length);

      // Update full list
      this.allIncidents.set(unifiedIncidents);
      
      // For map view, show all incidents
      this.incidents.set(unifiedIncidents);
      
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
    
    // ✅ Aplicar filtro automáticamente usando computed signal
    const filtered = this.filteredIncidents();
    this.incidents.set(filtered);
    
    console.log('✅ Filter applied:', {
      filter,
      total: this.allIncidents().length,
      filtered: filtered.length
    });
    
    // Si estamos en vista de mapa, actualizar el mapa con el filtro
    if (this.viewMode() === 'map') {
      this.loadIncidentsForMap();
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
          
          // Normalize and set filtered map results
          const unified = response.data.map(mapApiToIncident);
          this.allIncidents.set(unified);
          this.incidents.set(unified);
          
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

  selectIncident(incidentOrId: UnifiedIncident | number) {
    this.loadingDetail.set(true);
    this.selectedIncident.set(null);
    this.clearAiAnalysisState();
    
    const incidentId = typeof incidentOrId === 'number' ? incidentOrId : incidentOrId.id;
    
    // Fetch full detail and normalize through the unified adapter
    this.http.get<ApiDetailResponse>(`${this.apiUrl}/${incidentId}`).subscribe({
      next: (response) => {
        const unified = mapApiToIncident(response.data);
        this.selectedIncident.set(unified);
        this.loadingDetail.set(false);
        this.loadIncidentAiAnalysisData(incidentId);
        if (this.viewMode() === 'map') {
          const incident = this.allIncidents().find(i => i.id === incidentId);
          if (incident) {
            this.centerMapOnIncident(incident);
          }
        }
      },
      error: (err) => {
        console.error('Error loading incident detail:', err);
        this.error.set('Error al cargar el detalle del incidente');
        this.loadingDetail.set(false);
      }
    });
  }

  onViewDetail(incidentId: number): void {
    this.router.navigate(['/workshop/incidents', incidentId]);
  }

  openMapFullScreen(): void {
    this.router.navigate(['/workshop/incidents/map']);
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

  centerMapOnIncident(incident: UnifiedIncident) {
    if (!incident.latitude || !incident.longitude || !this.map) {
      console.warn('Incident has no coordinates');
      return;
    }
    const position: [number, number] = [incident.latitude, incident.longitude];
    this.map.setView(position, 15);
  }

  initMiniMap(incident: UnifiedIncident) {
    try {
      const mapElement = document.getElementById(`mini-map-${incident.id}`);
      if (!mapElement || !this.L) return;

      // Validar coordenadas
      if (incident.latitude === null || incident.longitude === null) {
        console.warn('Incident has no coordinates, cannot display mini map');
        return;
      }

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
    } catch (error) {
      console.warn(`Failed to initialize mini map for incident ${incident.id}:`, error);
    }
  }

  getMarkerColor(estado: string): string {
    const colors: Record<string, string> = {
      'pendiente': '#f59e0b',
      'asignado': '#3b82f6',
      'en_proceso': '#8b5cf6',
      'resuelto': '#10b981',
      'cancelado': '#6b7280',
      'sin_taller_disponible': '#dc2626'
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
      'aceptado': 'Aceptado',
      'en_camino': 'En Camino',
      'en_proceso': 'En Proceso',
      'resuelto': 'Resuelto',
      'cancelado': 'Cancelado',
      'sin_taller_disponible': 'Sin Taller'
    };
    return labels[estado] || estado;
  }

  getEstadoColor(estado: string): string {
    const colors: Record<string, string> = {
      'pendiente': 'warning',
      'asignado': 'info',
      'en_proceso': 'primary',
      'resuelto': 'success',
      'cancelado': 'secondary',
      'sin_taller_disponible': 'danger'
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

  openAcceptModal(incident: UnifiedIncident) {
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

    this.http.post<ApiDetailResponse>(`${this.apiUrl}/${incident.id}/aceptar`, {
      accept_suggested_technician: acceptWithTechnician
    }).subscribe({
      next: (response) => {
        const message = acceptWithTechnician 
          ? 'Solicitud aceptada con técnico asignado. El incidente está en proceso.'
          : 'Solicitud aceptada. Ahora puedes asignar un técnico manualmente.';
        this.success.set(message);
        
        // Update selected incident with normalized response data
        if (response.data) {
          const unified = mapApiToIncident(response.data);
          this.selectedIncident.set(unified);

          // Partial update: update incident status in full list instead of reloading
          const all = this.allIncidents();
          const idx = all.findIndex(i => i.id === incident.id);
          if (idx !== -1) {
            const updated = [...all];
            updated[idx] = { ...updated[idx], estado: unified.estado, estado_actual: unified.estado, updated_at: unified.updated_at };
            this.allIncidents.set(updated);
          }
          console.log('✅ Selected incident updated with response data:', unified);
        }

        this.closeAcceptModal();
        this.loadStatusCounts();
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

  openRejectModal(incident: UnifiedIncident) {
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

        // Partial update: remove rejected incident from list
        const all = this.allIncidents();
        this.allIncidents.set(all.filter(i => i.id !== incident.id));
        this.selectedIncident.set(null);
        this.loadStatusCounts();
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

  openAssignTechnicianModal(incident: UnifiedIncident) {
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

        // Partial update: update incident status to en_proceso
        const all = this.allIncidents();
        const idx = all.findIndex(i => i.id === incident.id);
        if (idx !== -1) {
          const updated = [...all];
          updated[idx] = { ...updated[idx], estado: 'en_proceso', estado_actual: 'en_proceso', tecnico_id: technicianId };
          this.allIncidents.set(updated);
        }
        this.selectedIncident.set(null);
        this.loadStatusCounts();
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

  openTrackingView(incident: UnifiedIncident) {
    // Navegar a la vista de seguimiento con mapa completo y chat
    this.router.navigate(['/tracking/incident', incident.id]);
  }

  /**
   * ✅ Start timeout checker - now reactive via WebSocket events
   * The backend publishes incident.assignment_timeout via EventPublisher.
   * IncidentsService handles the event and updates incidents list reactively.
   * No client-side polling needed.
   */
   startTimeoutChecker() {
     this.incidentsService.incidentTimeout$
       .pipe(takeUntilDestroyed(this.destroyRef))
       .subscribe((event: any) => {
         const timedOutIncidentId = event.incident_id;
         const assignmentMode = event.assignment_mode;
         const currentAll = this.allIncidents();
         const idx = currentAll.findIndex(i => i.id === timedOutIncidentId);

         if (idx === -1) return;

         // MODO MANUAL: remover incidente de la lista del taller en tiempo real
         // (el backend ya limpió taller_id, este incidente ya no pertenece a este taller)
         if (assignmentMode === 'manual') {
           const updated = currentAll.filter(i => i.id !== timedOutIncidentId);
           this.allIncidents.set(updated);
           this.applyCurrentFilter();
           console.log(`Incident #${timedOutIncidentId} removed from list (manual timeout)`);
           return;
         }

         // MODO AUTO: comportamiento existente (marcar como timed out)
         if (!(currentAll[idx] as any)._isTimedOut) {
           const updated = [...currentAll];
           updated[idx] = {
             ...updated[idx],
             _isTimedOut: true,
             estado: 'sin_taller_disponible' as any,
             estado_actual: 'sin_taller_disponible' as any,
           };
           this.allIncidents.set(updated);
           this.applyCurrentFilter();
           console.log(`Incident #${timedOutIncidentId} timed out (via WebSocket event)`);
         }
       });
     console.log('Timeout checker initialized (reactive via WebSocket events)');
   }

  /**
   * ✅ Stop timeout checker
   * No-op since timeouts are now managed via WebSocket event subscriptions
   * (unsubscribed automatically via takeUntilDestroyed)
   */
  stopTimeoutChecker() {
    console.log('⏹️ Timeout checker stopped');
  }

  /**
   * ✅ Verificar si un incidente está en timeout
   */
  isIncidentTimedOut(incident: UnifiedIncident): boolean {
    return incident._isTimedOut === true;
  }

}
