import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { IncidentsService, type IncidentAiAnalysis } from '../../../core/services/incidents.service';
import { Incident, IncidentStatus, IncidentPriority } from '../../../core/models/incident.model';

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

interface ApiDetailResponse {
  success: boolean;
  data: ApiIncidentRaw;
  message: string;
}

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
  evidencias?: ApiEvidenciaRaw[];
  imagenes?: ApiImagenRaw[];
  audios?: ApiAudioRaw[];
};

function mapApiToIncident(raw: ApiIncidentRaw): UnifiedIncident {
  const prioridad = mapBackendPriority(raw.prioridad_ia);
  const estado = mapBackendStatus(raw.estado_actual);

  let suggested: any = null;
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

  const categoria: any = raw.categoria_ia
    ? { id: 0, nombre: raw.categoria_ia, descripcion: '', icono: null }
    : undefined;

  return {
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

@Component({
  selector: 'app-workshop-incident-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.css'
})
export class WorkshopIncidentDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly incidentsService = inject(IncidentsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  incident = signal<UnifiedIncident | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  latestAiAnalysis = signal<IncidentAiAnalysis | null>(null);
  aiLoading = signal(false);
  selectedImage = signal<string | null>(null);

  showAcceptModal = signal(false);
  showRejectModal = signal(false);
  showAssignTechnicianModal = signal(false);
  acceptWithSuggestedTechnician = signal(false);
  rejectReason = signal('');
  availableTechnicians = signal<any[]>([]);
  selectedTechnicianId = signal<number | null>(null);
  loadingTechnicians = signal(false);
  isProcessing = signal(false);
  success = signal<string | null>(null);

  ngOnInit(): void {
    const incidentId = this.route.snapshot.paramMap.get('id');
    if (incidentId) {
      this.loadIncident(parseInt(incidentId, 10));
    } else {
      this.error.set('ID de incidente no válido');
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
  }

  loadIncident(incidentId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<ApiDetailResponse>(`${this.apiUrl}/${incidentId}`).subscribe({
      next: (response) => {
        this.incident.set(mapApiToIncident(response.data));
        this.loading.set(false);
        this.loadIncidentAiAnalysisData(incidentId);
      },
      error: (err) => {
        console.error('Error loading incident:', err);
        this.error.set('Error al cargar los datos del incidente');
        this.loading.set(false);
      }
    });
  }

  loadIncidentAiAnalysisData(incidentId: number): void {
    this.aiLoading.set(true);
    this.incidentsService.getLatestIncidentAiAnalysis(incidentId).subscribe({
      next: (analysis: IncidentAiAnalysis | null) => {
        this.latestAiAnalysis.set(analysis);
        this.aiLoading.set(false);
      },
      error: () => {
        this.latestAiAnalysis.set(null);
        this.aiLoading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/workshop/incidents']);
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

  formatAiConfidence(confidence: number | null): string {
    if (confidence === null || Number.isNaN(confidence)) return 'N/D';
    return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
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

  openImageModal(imageUrl: string): void {
    this.selectedImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.selectedImage.set(null);
  }

  openAcceptModal(): void {
    this.showAcceptModal.set(true);
    this.acceptWithSuggestedTechnician.set(this.hasSuggestedTechnician());
  }

  closeAcceptModal(): void {
    this.showAcceptModal.set(false);
    this.acceptWithSuggestedTechnician.set(false);
  }

  acceptIncident(): void {
    const incident = this.incident();
    if (!incident || this.isProcessing()) return;
    const acceptSuggested = this.acceptWithSuggestedTechnician() && this.hasSuggestedTechnician();

    this.isProcessing.set(true);
    this.error.set(null);

    this.http.post<ApiDetailResponse>(`${this.apiUrl}/${incident.id}/aceptar`, {
      accept_suggested_technician: acceptSuggested
    }).subscribe({
      next: (response) => {
        this.success.set('Solicitud aceptada exitosamente');
        if (response.data) {
          this.incident.set(mapApiToIncident(response.data));
        }
        this.closeAcceptModal();
        this.isProcessing.set(false);
        setTimeout(() => this.success.set(null), 5000);
      },
      error: (err) => {
        console.error('Error accepting incident:', err);
        this.error.set(err.error?.message || 'Error al aceptar la solicitud');
        this.isProcessing.set(false);
      }
    });
  }

  hasSuggestedTechnician(): boolean {
    return !!this.incident()?.suggested_technician;
  }

  getSuggestedTechnicianReason(): string | null {
    return this.incident()?.suggested_technician_info?.ai_reasoning ?? null;
  }

  openRejectModal(): void {
    this.showRejectModal.set(true);
    this.rejectReason.set('');
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.rejectReason.set('');
  }

  rejectIncident(): void {
    const incident = this.incident();
    if (!incident || this.isProcessing()) return;

    const reason = this.rejectReason().trim();
    if (reason.length < 10) {
      this.error.set('El motivo debe tener al menos 10 caracteres');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);

    this.http.post<any>(`${this.apiUrl}/${incident.id}/rechazar`, { motivo: reason }).subscribe({
      next: () => {
        this.success.set('Solicitud rechazada');
        this.closeRejectModal();
        this.isProcessing.set(false);
        this.goBack();
      },
      error: (err) => {
        console.error('Error rejecting incident:', err);
        this.error.set(err.error?.message || 'Error al rechazar la solicitud');
        this.isProcessing.set(false);
      }
    });
  }

  openAssignTechnicianModal(): void {
    const incident = this.incident();
    if (!incident?.taller_id) return;
    
    this.showAssignTechnicianModal.set(true);
    this.selectedTechnicianId.set(null);
    this.loadAvailableTechnicians(incident.taller_id);
  }

  closeAssignTechnicianModal(): void {
    this.showAssignTechnicianModal.set(false);
    this.selectedTechnicianId.set(null);
    this.availableTechnicians.set([]);
  }

  loadAvailableTechnicians(workshopId: number): void {
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

  assignTechnician(): void {
    const incident = this.incident();
    const technicianId = this.selectedTechnicianId();
    if (!incident || !technicianId || this.isProcessing()) return;

    this.isProcessing.set(true);
    this.error.set(null);

    this.http.post<any>(`${environment.apiUrl}/real-time/incidents/${incident.id}/assign`, {
      technician_id: technicianId
    }).subscribe({
      next: () => {
        this.success.set('Técnico asignado exitosamente');
        this.closeAssignTechnicianModal();
        this.isProcessing.set(false);
        this.loadIncident(incident.id);
        setTimeout(() => this.success.set(null), 5000);
      },
      error: (err) => {
        console.error('Error assigning technician:', err);
        this.error.set(err.error?.message || 'Error al asignar técnico');
        this.isProcessing.set(false);
      }
    });
  }

  openTrackingView(): void {
    const incident = this.incident();
    if (incident) {
      this.router.navigate(['/tracking/incident', incident.id]);
    }
  }
}
