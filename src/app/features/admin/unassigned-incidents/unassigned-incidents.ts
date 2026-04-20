import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IncidentsService, type Incident } from '../../../core/services/incidents.service';

@Component({
  selector: 'app-unassigned-incidents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unassigned-incidents.html',
  styleUrl: './unassigned-incidents.css'
})
export class UnassignedIncidentsComponent implements OnInit, OnDestroy {
  private readonly incidentsService = inject(IncidentsService);
  private readonly router = inject(Router);
  private timeUpdateInterval: any = null;

  incidents = signal<Incident[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  readonly incidentCount = computed(() => this.incidents().length);

  ngOnInit() {
    this.loadIncidents();
    // Actualizar el tiempo cada segundo para recalcular timeouts
    this.timeUpdateInterval = setInterval(() => {
      // Forzar actualización de la vista
      this.incidents.set([...this.incidents()]);
    }, 1000);
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

  viewIncidentDetail(incident: Incident) {
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

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
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
