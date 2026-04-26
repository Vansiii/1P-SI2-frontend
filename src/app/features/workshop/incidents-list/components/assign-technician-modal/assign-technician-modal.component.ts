import { Component, ChangeDetectionStrategy, input, output, signal, OnInit, inject, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Incident } from '../../../../../core/models/incident.model';
import { TechnicianService, Technician } from '../../../../../core/services/technician.service';
import { AuthService } from '../../../../../core/services/auth.service';

/**
 * AssignTechnicianModalComponent
 * 
 * Modal for manually assigning a technician to an incident.
 * Displays available technicians with their specialties and availability.
 * 
 * Features:
 * - Load available technicians
 * - Display technician list with specialties
 * - Selection logic
 * - Keyboard navigation (Escape to close, Enter to confirm)
 * 
 * Requirements: 5.3, 5.4, 12.2, 12.3
 */
@Component({
  selector: 'app-assign-technician-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assign-technician-modal.component.html',
  styleUrl: './assign-technician-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'assign-technician-modal-title'
  }
})
export class AssignTechnicianModalComponent implements OnInit {
  private technicianService = inject(TechnicianService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  // Input signals
  incident = input.required<Incident>();

  // Output signals
  assign = output<number>();
  cancel = output<void>();

  // Local signals
  technicians = signal<Technician[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  selectedTechnicianId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadTechnicians();
  }

  /**
   * Load available technicians
   */
  loadTechnicians(): void {
    this.loading.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser || !currentUser.workshop_id) {
      this.error.set('No se pudo obtener el taller actual');
      this.loading.set(false);
      return;
    }

    // Get category_id from incident if available for specialty filtering
    const categoryId = this.incident().categoria_id;

    this.technicianService.getAvailableTechnicians(currentUser.workshop_id, categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (technicians) => {
          this.technicians.set(technicians);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading technicians:', error);
          this.error.set('Error al cargar técnicos disponibles');
          this.loading.set(false);
        }
      });
  }

  /**
   * Select a technician
   */
  selectTechnician(technicianId: number): void {
    this.selectedTechnicianId.set(technicianId);
  }

  /**
   * Check if technician is selected
   */
  isSelected(technicianId: number): boolean {
    return this.selectedTechnicianId() === technicianId;
  }

  /**
   * Confirm assignment
   */
  confirmAssign(): void {
    const technicianId = this.selectedTechnicianId();
    
    if (technicianId === null) {
      return;
    }

    this.assign.emit(technicianId);
  }

  /**
   * Cancel and close modal
   */
  onCancel(): void {
    this.cancel.emit();
  }

  /**
   * Check if confirm button should be disabled
   */
  isConfirmDisabled(): boolean {
    return this.selectedTechnicianId() === null || this.loading();
  }

  /**
   * Get specialties as comma-separated string
   */
  getSpecialtiesText(technician: Technician): string {
    if (!technician.especialidades || technician.especialidades.length === 0) {
      return 'Sin especialidades';
    }
    return technician.especialidades.map(e => e.nombre).join(', ');
  }

  /**
   * Get technician full name
   */
  getTechnicianName(technician: Technician): string {
    return `${technician.first_name} ${technician.last_name}`;
  }

  /**
   * Handle Escape key to close modal
   */
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    this.onCancel();
  }

  /**
   * Handle Enter key to confirm (if technician selected)
   */
  @HostListener('document:keydown.enter')
  handleEnterKey(): void {
    if (!this.isConfirmDisabled()) {
      this.confirmAssign();
    }
  }
}
