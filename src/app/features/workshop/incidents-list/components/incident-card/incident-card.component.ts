import { Component, ChangeDetectionStrategy, input, computed, output, HostBinding, HostListener, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Incident, IncidentPriority, IncidentStatus } from '../../../../../core/models/incident.model';

@Component({
  selector: 'app-incident-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incident-card.component.html',
  styleUrl: './incident-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentCardComponent {
  private readonly router = inject(Router);
  incident = input.required<Incident>();
  viewDetail = output<number>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly tick = signal(0);

  constructor() {
    const id = setInterval(() => this.tick.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  @HostBinding('class') get hostClass(): string {
    return 'incident-card-wrapper';
  }

  @HostListener('click')
  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  handleClick(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.router.navigate(['/workshop/incidents', this.incident().id]);
  }

  onViewDetailClick(event: Event): void {
    event.stopPropagation();
    this.viewDetail.emit(this.incident().id);
  }

  incidentId = computed(() => this.incident().id);

  private getIncidentStatus(): IncidentStatus {
    const incident = this.incident() as Incident & { estado_actual?: IncidentStatus };
    return (incident.estado_actual || incident.estado || 'pendiente') as IncidentStatus;
  }

  statusLabel = computed(() => {
    const status = this.getIncidentStatus();
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      asignado: 'Asignado',
      aceptado: 'Aceptado',
      en_camino: 'En Camino',
      en_proceso: 'En Proceso',
      resuelto: 'Resuelto',
      cancelado: 'Cancelado',
      sin_taller_disponible: 'Sin Taller'
    };
    return labels[status] || status;
  });

  hasTimeout = computed(() => {
    this.tick();
    const inc = this.incident();
    if (this.getIncidentStatus() !== 'pendiente') return false;
    if (!inc.suggested_technician?.timeout_at) return false;
    return new Date(inc.suggested_technician.timeout_at) < new Date();
  });

  hasPendingTimeout = computed(() => {
    this.tick();
    const inc = this.incident();
    if (this.getIncidentStatus() !== 'pendiente') return false;
    if (!inc.suggested_technician?.timeout_at) return false;
    const timeoutDate = new Date(inc.suggested_technician.timeout_at);
    return timeoutDate.getTime() > Date.now();
  });

  countdownDisplay = computed(() => {
    this.tick();
    const inc = this.incident();
    if (this.getIncidentStatus() !== 'pendiente') return null;
    if (!inc.suggested_technician?.timeout_at) return null;
    const timeoutDate = new Date(inc.suggested_technician.timeout_at);
    const diffMs = timeoutDate.getTime() - Date.now();
    if (diffMs <= 0) return null;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours}h ${remMins}m ${secs}s`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  timeElapsed = computed(() => {
    this.tick();
    const createdAt = this.incident().created_at;
    const date = new Date(createdAt);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  });

  truncatedDescription = computed(() => {
    const desc = this.incident().descripcion || '';
    if (desc.length <= 100) return desc;
    return desc.substring(0, 100) + '...';
  });

  locationText = computed(() => {
    return this.incident().ubicacion || this.incident().direccion_referencia || 'Sin ubicación';
  });

  categoryName = computed(() => {
    return this.incident().categoria?.nombre || this.incident().categoria_id?.toString() || '';
  });

  priorityLabel = computed(() => {
    const priority = this.incident().prioridad;
    const labels: Record<string, string> = {
      alta: 'Alta',
      media: 'Media',
      baja: 'Baja'
    };
    return labels[priority] || priority;
  });

  priorityColor = computed(() => {
    const colors: Record<string, string> = {
      alta: '#dc2626',
      media: '#d97706',
      baja: '#2563eb'
    };
    return colors[this.incident().prioridad] || '#6b7280';
  });

  statusBadgeClass = computed(() => {
    const status = this.getIncidentStatus();
    const statusMap: Record<string, string> = {
      pendiente: 'badge-warning',
      asignado: 'badge-blue',
      aceptado: 'badge-green',
      en_camino: 'badge-purple',
      en_proceso: 'badge-orange',
      resuelto: 'badge-emerald',
      cancelado: 'badge-red',
      sin_taller_disponible: 'badge-red'
    };
    return statusMap[status] || 'badge-gray';
  });
}
