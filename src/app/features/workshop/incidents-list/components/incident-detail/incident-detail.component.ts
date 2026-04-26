import { Component, ChangeDetectionStrategy, input, output, OnInit, inject, signal, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { Incident, AIAnalysis } from '../../../../../core/models/incident.model';
import { IncidentsService } from '../../../../../core/services/incidents.service';
import { WebSocketService } from '../../../../../core/services/websocket.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { RealtimeEvent } from '../../../../../core/models/realtime-events.models';
import { AcceptModalComponent, AcceptData } from '../accept-modal/accept-modal.component';
import { RejectModalComponent } from '../reject-modal/reject-modal.component';
import { AssignTechnicianModalComponent } from '../assign-technician-modal/assign-technician-modal.component';
import { LazyImageDirective } from '../../../../../shared/directives/lazy-image.directive';

/**
 * IncidentDetailComponent (Smart Component)
 * 
 * Displays detailed information about an incident in a side panel.
 * Handles user actions (accept, reject) and real-time updates.
 * 
 * Features:
 * - Display complete incident information
 * - Load and display AI analysis
 * - Accept/reject incident actions
 * - Real-time updates via WebSocket
 * - Navigation to tracking view
 * - Auto-close when incident is accepted by another workshop
 * - Keyboard navigation (Escape to close)
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.2, 5.3, 5.4, 12.2
 */
@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [CommonModule, AcceptModalComponent, RejectModalComponent, AssignTechnicianModalComponent, LazyImageDirective],
  templateUrl: './incident-detail.component.html',
  styleUrl: './incident-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'incident-detail-title'
  }
})
export class IncidentDetailComponent implements OnInit {
  // Injected services
  private incidentsService = inject(IncidentsService);
  private webSocketService = inject(WebSocketService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Input signals
  incident = input.required<Incident>();

  // Output signals
  close = output<void>();

  // Local signals
  loadingAction = signal<boolean>(false);
  showAcceptModal = signal<boolean>(false);
  showRejectModal = signal<boolean>(false);
  showAssignTechnicianModal = signal<boolean>(false);
  aiAnalysis = signal<AIAnalysis | null>(null);
  loadingAI = signal<boolean>(false);

  ngOnInit(): void {
    this.loadAIAnalysis();
    this.subscribeToIncidentUpdates();
  }

  /**
   * Load AI analysis for the incident
   */
  private async loadAIAnalysis(): Promise<void> {
    const incidentId = this.incident().id;
    
    // Only load if incident has AI analysis
    if (!this.incident().ai_analysis) {
      return;
    }

    this.loadingAI.set(true);
    
    try {
      const analysis = await this.incidentsService.getAIAnalysis(incidentId);
      this.aiAnalysis.set(analysis);
    } catch (error) {
      console.error('Error loading AI analysis:', error);
      this.aiAnalysis.set(null);
    } finally {
      this.loadingAI.set(false);
    }
  }

  /**
   * Subscribe to WebSocket events for this incident
   */
  private subscribeToIncidentUpdates(): void {
    const incidentId = this.incident().id;

    this.webSocketService.messages$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((event: RealtimeEvent) => {
          // Filter events related to this incident
          return event.data && 'incident_id' in event.data && event.data.incident_id === incidentId;
        })
      )
      .subscribe((event: RealtimeEvent) => {
        this.handleRealtimeEvent(event);
      });
  }

  /**
   * Handle real-time events for this incident
   */
  private handleRealtimeEvent(event: RealtimeEvent): void {
    switch (event.type) {
      case 'incident.assignment_accepted':
        // Another workshop accepted the incident, close detail
        this.closeDetail();
        break;
      
      case 'incident.status_changed':
        // Status changed, could refresh incident data
        console.log('Incident status changed:', event.data);
        break;
      
      case 'incident.cancelled':
        // Incident was cancelled, close detail
        this.closeDetail();
        break;
      
      default:
        console.log('Unhandled event type:', event.type);
    }
  }

  /**
   * Close the detail panel
   */
  closeDetail(): void {
    this.close.emit();
  }

  /**
   * Open accept modal
   */
  openAcceptModal(): void {
    this.showAcceptModal.set(true);
  }

  /**
   * Open reject modal
   */
  openRejectModal(): void {
    this.showRejectModal.set(true);
  }

  /**
   * Open assign technician modal
   */
  openAssignTechnicianModal(): void {
    this.showAssignTechnicianModal.set(true);
  }

  /**
   * Handle accept incident action
   */
  async handleAccept(data: AcceptData): Promise<void> {
    // If manual assignment selected, open assign technician modal
    if (!data.acceptWithSuggested && data.technicianId === null) {
      this.showAcceptModal.set(false);
      this.showAssignTechnicianModal.set(true);
      return;
    }

    // Otherwise, proceed with acceptance
    this.loadingAction.set(true);
    
    try {
      const response = await this.incidentsService.acceptIncident(
        this.incident().id,
        data.technicianId
      );
      
      console.log('Incident accepted:', response);
      
      // Show success toast
      this.toastService.success('Solicitud aceptada exitosamente');
      
      // Close modal and detail
      this.showAcceptModal.set(false);
      this.closeDetail();
    } catch (error) {
      console.error('Error accepting incident:', error);
      
      // Show error toast
      this.toastService.error('Error al aceptar la solicitud. Por favor, intenta de nuevo.');
    } finally {
      this.loadingAction.set(false);
    }
  }

  /**
   * Handle reject incident action
   */
  async handleReject(reason: string): Promise<void> {
    this.loadingAction.set(true);
    
    try {
      const response = await this.incidentsService.rejectIncident(
        this.incident().id,
        reason
      );
      
      console.log('Incident rejected:', response);
      
      // Show success toast
      this.toastService.success('Solicitud rechazada exitosamente');
      
      // Close modal and detail
      this.showRejectModal.set(false);
      this.closeDetail();
    } catch (error) {
      console.error('Error rejecting incident:', error);
      
      // Show error toast
      this.toastService.error('Error al rechazar la solicitud. Por favor, intenta de nuevo.');
    } finally {
      this.loadingAction.set(false);
    }
  }

  /**
   * Handle assign technician action
   */
  async handleAssignTechnician(technicianId: number): Promise<void> {
    this.loadingAction.set(true);
    
    try {
      const response = await this.incidentsService.acceptIncident(
        this.incident().id,
        technicianId
      );
      
      console.log('Technician assigned:', response);
      
      // Show success toast
      this.toastService.success('Técnico asignado exitosamente');
      
      // Close modal and detail
      this.showAssignTechnicianModal.set(false);
      this.closeDetail();
    } catch (error) {
      console.error('Error assigning technician:', error);
      
      // Show error toast
      this.toastService.error('Error al asignar técnico. Por favor, intenta de nuevo.');
    } finally {
      this.loadingAction.set(false);
    }
  }

  /**
   * Navigate to tracking view
   */
  goToTracking(): void {
    this.router.navigate(['/tracking', this.incident().id], {
      state: { incident: this.incident() }
    });
  }

  /**
   * Check if incident can be accepted
   */
  canAccept(): boolean {
    const estado = this.incident().estado;
    return estado === 'pendiente' || estado === 'asignado';
  }

  /**
   * Check if incident can be rejected
   */
  canReject(): boolean {
    const estado = this.incident().estado;
    return estado === 'pendiente' || estado === 'asignado';
  }

  /**
   * Check if tracking button should be shown
   */
  canGoToTracking(): boolean {
    const estado = this.incident().estado;
    return estado === 'aceptado' || estado === 'en_camino' || estado === 'en_proceso';
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get status display text
   */
  getStatusText(): string {
    return this.incident().estado.replace('_', ' ').toUpperCase();
  }

  /**
   * Get priority display text
   */
  getPriorityText(): string {
    return this.incident().prioridad.toUpperCase();
  }

  /**
   * Handle Escape key to close detail panel (only if no modals are open)
   */
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    // Only close detail if no modals are open
    if (!this.showAcceptModal() && !this.showRejectModal() && !this.showAssignTechnicianModal()) {
      this.closeDetail();
    }
  }
}
