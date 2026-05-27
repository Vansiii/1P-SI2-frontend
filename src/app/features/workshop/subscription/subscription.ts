import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

interface PlanInfo {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  max_technicians: number;
  max_services: number;
  enable_kpis: boolean;
  enable_reports: boolean;
  enable_realtime_tracking: boolean;
  enable_quotes: boolean;
  enable_voice_reports: boolean;
  enable_priority_support: boolean;
}

interface SubscriptionInfo {
  id: number;
  tenant_id: number;
  plan_id: number;
  pending_plan_id: number | null;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  payment_provider: string;
  grace_until: string | null;
  plan: PlanInfo;
  pending_plan?: PlanInfo | null;
}

interface Invoice {
  id: number;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  invoice_url: string | null;
  created_at: string;
}

@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [],
  templateUrl: './subscription.html',
  styleUrl: './subscription.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  readonly subscription = signal<SubscriptionInfo | null>(null);
  readonly plans = signal<PlanInfo[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly isSubscribing = signal(false);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showPlans = signal(false);

  readonly isPendingDowngrade = computed(() => this.subscription()?.status === 'pending_downgrade');
  readonly isPendingCancellation = computed(() =>
    this.subscription()?.status === 'pending_cancellation' || this.subscription()?.cancel_at_period_end
  );

  private readonly api = environment.apiBaseUrl;
  private readonly baseUrl = this.api.replace(/\/api\/v1\/?$/, '');

  ngOnInit(): void {
    const success = this.route.snapshot.queryParamMap.get('success');
    if (success === 'true') {
      this.verifyPayment();
      this.router.navigate([], { queryParams: { success: undefined }, replaceUrl: true });
    } else {
      this.loadSubscription();
      this.loadInvoices();
    }
  }

  verifyPayment(): void {
    this.isLoading.set(true);
    this.http.post<{ data: SubscriptionInfo | null; message: string }>(
      `${this.baseUrl}/api/v1/workshop/subscription/verify-payment`, {}
    ).pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (r) => {
          this.subscription.set(r.data);
          this.loadInvoices();
        },
        error: () => {
          this.loadSubscription();
          this.loadInvoices();
        },
      });
  }

  loadSubscription(): void {
    this.isLoading.set(true);
    this.http.get<{ data: SubscriptionInfo | null; message: string }>(`${this.baseUrl}/api/v1/workshop/subscription`)
      .subscribe({
        next: (r) => { this.subscription.set(r.data); this.isLoading.set(false); },
        error: () => { this.isLoading.set(false); this.error.set('No se pudo cargar la suscripcion'); }
      });
  }

  loadPlans(): void {
    this.showPlans.set(true);
    this.http.get<{ data: PlanInfo[]; message: string }>(`${this.baseUrl}/api/v1/workshop/subscription/plans`)
      .subscribe({
        next: (r) => this.plans.set(r.data),
        error: () => this.error.set('No se pudieron cargar los planes')
      });
  }

  loadInvoices(): void {
    this.http.get<{ data: Invoice[]; message: string }>(`${this.baseUrl}/api/v1/workshop/subscription/invoices`)
      .subscribe({
        next: (r) => this.invoices.set(r.data),
        error: () => this.error.set('No se pudieron cargar las facturas')
      });
  }

  subscribe(planId: number): void {
    this.isSubscribing.set(true);
    this.error.set(null);
    this.http.post<{ data: { checkout_url?: string; status?: string; plan?: string }; message: string }>(
      `${this.baseUrl}/api/v1/workshop/subscription/subscribe?plan_id=${planId}`, {}
    ).pipe(finalize(() => this.isSubscribing.set(false)))
      .subscribe({
        next: (r) => {
          if (r.data?.checkout_url) {
            window.location.href = r.data.checkout_url;
          } else {
            this.loadSubscription();
            this.showPlans.set(false);
          }
        },
        error: (e) => this.error.set(e.error?.detail || 'Error al contratar plan')
      });
  }

  changePlan(planId: number): void {
    this.isSubscribing.set(true);
    this.error.set(null);
    this.http.post<{ data: { url?: string; message: string }; message: string }>(
      `${this.baseUrl}/api/v1/workshop/subscription/change-plan?plan_id=${planId}`, {}
    ).pipe(finalize(() => this.isSubscribing.set(false)))
      .subscribe({
        next: (r) => {
          if (r.data?.url) { window.location.href = r.data.url; }
          else { this.loadSubscription(); this.showPlans.set(false); }
        },
        error: (e) => this.error.set(e.error?.detail || 'Error al cambiar plan')
      });
  }

  cancelSubscription(): void {
    if (!confirm('Al cancelar, tu suscripcion seguira activa hasta el fin del periodo actual. ¿Continuar?')) return;
    this.isSubscribing.set(true);
    this.http.post<{ data: { message: string } }>(`${this.baseUrl}/api/v1/workshop/subscription/cancel`, {})
      .pipe(finalize(() => this.isSubscribing.set(false)))
      .subscribe({
        next: () => this.loadSubscription(),
        error: (e) => this.error.set(e.error?.detail || 'Error al cancelar')
      });
  }

  reactivateSubscription(): void {
    if (!confirm('Tu suscripcion se reactivara y mantendras el plan actual. ¿Continuar?')) return;
    this.isSubscribing.set(true);
    this.http.post<{ data: { message: string } }>(`${this.baseUrl}/api/v1/workshop/subscription/reactivate`, {})
      .pipe(finalize(() => this.isSubscribing.set(false)))
      .subscribe({
        next: () => this.loadSubscription(),
        error: (e) => this.error.set(e.error?.detail || 'Error al reactivar')
      });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatCurrency(amount: number): string {
    return amount === 0 ? 'Gratuito' : `$${amount.toFixed(2)}/mes`;
  }

  invoiceStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      paid: 'Pagado', open: 'Pendiente', void: 'Anulado',
      uncollectible: 'Incobrable', draft: 'Borrador',
    };
    return labels[status] || status;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Activo', trialing: 'Prueba', past_due: 'Pago pendiente',
      suspended: 'Suspendido', canceled: 'Cancelado', expired: 'Expirado',
      pending_downgrade: 'Cambio pendiente', pending_cancellation: 'Cancelacion pendiente',
    };
    return labels[status] || status;
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      active: '#16a34a', trialing: '#2563eb', past_due: '#d97706',
      suspended: '#dc2626', canceled: '#6b7280', expired: '#991b1b',
      pending_downgrade: '#7c3aed', pending_cancellation: '#ea580c',
    };
    return colors[status] || '#6b7280';
  }

  featureLabel(key: string): string {
    const labels: Record<string, string> = {
      enable_kpis: 'KPIs avanzados',
      enable_reports: 'Reportes PDF/Excel',
      enable_realtime_tracking: 'Tracking en tiempo real',
      enable_quotes: 'Cotizaciones',
      enable_voice_reports: 'Reportes por voz',
      enable_priority_support: 'Soporte prioritario',
    };
    return labels[key] || key;
  }

  getPlanFeature(key: string): boolean {
    const sub = this.subscription();
    if (!sub) return false;
    return (sub.plan as any)[key] || false;
  }
}
