import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IncidentsService, type LegacyIncident } from '../../../core/services/incidents.service';
import { IncidentRealtimeService } from '../../../core/services/incident-realtime.service';

@Component({
  selector: 'app-unassigned-incidents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unassigned-incidents.html',
  styleUrl: './unassigned-incidents.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnassignedIncidentsComponent implements OnInit, OnDestroy {
  private readonly incidentsService = inject(IncidentsService);
  private readonly incidentRealtimeService = inject(IncidentRealtimeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private timeUpdateInterval: any = null;

  incidents = signal<LegacyIncident[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  readonly timeTick = signal(Date.now());

  readonly incidentCount = computed(() => this.incidents().length);

  constructor() {
    // Subscribe to real-time incident updates
    this.incidentRealtimeService.incidentUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        console.log('🔔 Incident update received in unassigned-incidents:', update);
        
        // Handle different update types
        switch (update.updateType) {
          case 'created':
            // Check if incident is unassigned (sin_taller_disponible)
            if (update.data?.estado_actual === 'sin_taller_disponible') {
              this.loadIncidents(); // Reload to get complete data
            }
            break;
          
          case 'status_changed':
            // If incident changed to sin_taller_disponible, add it
            if (update.data?.new_status === 'sin_taller_disponible') {
              this.loadIncidents();
            }
            // If incident changed from sin_taller_disponible, remove it
            else if (update.data?.old_status === 'sin_taller_disponible') {
              this.incidents.update(incidents =>
                incidents.filter(i => i.id !== update.incidentId)
              );
            }
            break;
          
          case 'assigned':
            // Remove incident from unassigned list
            this.incidents.update(incidents =>
              incidents.filter(i => i.id !== update.incidentId)
            );
            break;
          
          case 'cancelled':
            // Remove cancelled incident
            this.incidents.update(incidents =>
              incidents.filter(i => i.id !== update.incidentId)
            );
            break;
        }
      });

    // Subscribe to toast notifications
    this.incidentRealtimeService.toastNotifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        // Show toast notification for new unassigned incidents
        if (update.updateType === 'created' && update.data?.estado_actual === 'sin_taller_disponible') {
          console.log('🔔 New unassigned incident toast:', update.message);
          // TODO: Implement toast notification UI
        }
      });
  }

  ngOnInit() {
    this.loadIncidents();
    // Actualizar tiempos relativos cada 10 segundos (más frecuente para mejor sincronización)
    this.timeUpdateInterval = setInterval(() => {
      this.timeTick.set(Date.now());
    }, 10_000); // 10 segundos en lugar de 60
  }

  ngOnDestroy() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  loadIncidents() {
    this.loading.set(true);
    this.error.set(null);

    this.incidentsService.getUnassignedIncidents().subscribe({
      next: (data) => {
        console.log('Loaded incidents:', data); // Debug
        this.incidents.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading unassigned incidents:', err);
        this.error.set(err.error?.message || 'Error al cargar los incidentes sin taller');
        this.loading.set(false);
      }
    });
  }

  viewIncidentDetail(incident: LegacyIncident) {
    console.log('Navigating to incident detail:', incident); // Debug completo
    console.log('Incident ID:', incident.id, 'Type:', typeof incident.id); // Debug tipo
    
    // Navegar a la vista de detalle para administradores
    if (incident && incident.id && incident.id > 0) {
      this.router.navigate(['/admin/incident', incident.id]);
    } else {
      console.error('Incident ID is missing or invalid:', incident);
      this.error.set('ID de incidente inválido. Por favor, recarga la página.');
    }
  }

  refreshIncidents() {
    this.loadIncidents();
  }

  truncate(text: string, length: number): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  formatDate(dateString: string, _tick = this.timeTick()): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Manejar diferencias de sincronización de reloj
    if (diffMs < 0) {
      return 'Ahora';
    }

    if (diffSecs < 60) {
      if (diffSecs < 5) return 'Ahora';
      return `Hace ${diffSecs}s`;
    }
    
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short'
    });
  }

  isIncidentTimedOut(incident: any): boolean {
    const date = new Date(incident.created_at);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    // Tiempos límite según prioridad (en minutos)
    const timeoutLimits: Record<string, number> = {
      'alta': 2,
      'media': 5, 
      'baja': 10
    };
    
    const limit = timeoutLimits[incident.prioridad_ia?.toLowerCase()] || 5; // Default 5 min
    return diffMins >= limit;
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
}
