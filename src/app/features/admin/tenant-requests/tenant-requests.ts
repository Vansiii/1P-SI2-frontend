import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';

interface PendingTenant {
  tenant_id: number;
  legal_name: string;
  nit: string;
  business_type: string | null;
  workshop_name: string;
  owner_name: string;
  owner_email: string;
  address: string | null;
  plan_name: string | null;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-tenant-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-requests.html',
  styleUrl: './tenant-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantRequestsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly pending = signal<PendingTenant[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rejectingId = signal<number | null>(null);
  readonly rejectionReason = signal('');
  readonly selectedTenant = signal<PendingTenant | null>(null);

  ngOnInit(): void {
    this.loadPending();
  }

  loadPending(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.adminService.getPendingTenants()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.pending.set(data),
        error: (e) => this.error.set(e.error?.detail || 'Error al cargar solicitudes'),
      });
  }

  approve(tenantId: number): void {
    this.error.set(null);
    this.adminService.approveTenant(tenantId)
      .pipe(finalize(() => this.loadPending()))
      .subscribe({
        error: (e) => this.error.set(e.error?.detail || 'Error al aprobar'),
      });
  }

  openReject(tenant: PendingTenant): void {
    this.rejectingId.set(tenant.tenant_id);
    this.rejectionReason.set('');
  }

  confirmReject(): void {
    const id = this.rejectingId();
    const reason = this.rejectionReason().trim();
    if (!id || !reason) return;

    this.error.set(null);
    this.adminService.rejectTenant(id, reason)
      .pipe(finalize(() => { this.rejectingId.set(null); this.loadPending(); }))
      .subscribe({
        error: (e) => this.error.set(e.error?.detail || 'Error al rechazar'),
      });
  }

  cancelReject(): void {
    this.rejectingId.set(null);
    this.rejectionReason.set('');
  }

  openDetail(tenant: PendingTenant): void {
    this.selectedTenant.set(tenant);
  }

  closeDetail(): void {
    this.selectedTenant.set(null);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
