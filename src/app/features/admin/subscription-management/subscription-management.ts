import { ChangeDetectionStrategy, Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface AdminSubscription {
  id: number;
  tenant_id: number;
  plan_id: number;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider_subscription_id: string | null;
}

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-management.html',
  styleUrl: './subscription-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionManagementComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  readonly subscriptions = signal<AdminSubscription[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly filterStatus = signal('');
  readonly suspendingId = signal<number | null>(null);
  readonly suspendReason = signal('');

  // Computed stats
  readonly activeCount = computed(() => 
    this.subscriptions().filter(s => s.status === 'active').length
  );
  
  readonly suspendedCount = computed(() => 
    this.subscriptions().filter(s => s.status === 'suspended').length
  );
  
  readonly trialingCount = computed(() => 
    this.subscriptions().filter(s => s.status === 'trialing').length
  );

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.isLoading.set(true);
    this.error.set(null);
    const params = this.filterStatus() ? `?status=${this.filterStatus()}` : '';
    this.http.get<{ data: AdminSubscription[] }>(`${this.api}/admin/subscriptions${params}`)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (r) => this.subscriptions.set(r.data),
        error: (e) => this.error.set(e.error?.detail || 'Error al cargar suscripciones'),
      });
  }

  suspend(id: number): void {
    this.error.set(null);
    this.http.post<{ data: any }>(`${this.api}/admin/subscriptions/${id}/suspend`, { reason: this.suspendReason() || 'Suspendido por administrador' })
      .subscribe({
        next: () => { this.suspendingId.set(null); this.loadAll(); },
        error: (e) => this.error.set(e.error?.detail || 'Error al suspender'),
      });
  }

  reactivate(id: number): void {
    this.error.set(null);
    this.http.post<{ data: any }>(`${this.api}/admin/subscriptions/${id}/reactivate`, {})
      .subscribe({
        next: () => this.loadAll(),
        error: (e) => this.error.set(e.error?.detail || 'Error al reactivar'),
      });
  }

  openSuspend(id: number): void { this.suspendingId.set(id); this.suspendReason.set(''); }
  cancelSuspend(): void { this.suspendingId.set(null); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  statusLabel(s: string): string {
    const m: Record<string,string> = { 
      active:'Activo', 
      trialing:'Prueba', 
      past_due:'Pago pendiente', 
      suspended:'Suspendido', 
      canceled:'Cancelado' 
    };
    return m[s] || s;
  }

  statusColor(s: string): string {
    const c: Record<string,string> = { 
      active:'#16a34a', 
      trialing:'#2563eb', 
      past_due:'#d97706', 
      suspended:'#dc2626', 
      canceled:'#6b7280' 
    };
    return c[s] || '#6b7280';
  }
}
