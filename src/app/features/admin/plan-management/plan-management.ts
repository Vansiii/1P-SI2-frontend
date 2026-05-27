import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface Plan {
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
  sort_order: number;
  is_active: boolean;
}

const emptyPlan = (): Plan => ({
  id: 0, code: '', name: '', description: '', price: 0, billing_period: 'monthly',
  max_technicians: 5, max_services: 20,
  enable_kpis: false, enable_reports: false, enable_realtime_tracking: false,
  enable_quotes: false, enable_voice_reports: false, enable_priority_support: false,
  sort_order: 0, is_active: true,
});

@Component({
  selector: 'app-plan-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan-management.html',
  styleUrl: './plan-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanManagementComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  readonly plans = signal<Plan[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editing = signal<Plan | null>(null);
  readonly isCreating = signal(false);
  readonly isSaving = signal(false);

  ngOnInit(): void { this.loadPlans(); }

  loadPlans(): void {
    this.isLoading.set(true);
    this.http.get<{ data: Plan[] }>(`${this.api}/admin/plans`)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({ next: r => this.plans.set(r.data), error: () => this.error.set('Error') });
  }

  startCreate(): void {
    this.editing.set({ ...emptyPlan() });
    this.isCreating.set(true);
  }

  startEdit(plan: Plan): void {
    this.editing.set({ ...plan });
    this.isCreating.set(false);
  }

  cancelEdit(): void { this.editing.set(null); }

  save(): void {
    const plan = this.editing();
    if (!plan || !plan.code || !plan.name) return;
    this.isSaving.set(true);
    const req = this.isCreating()
      ? this.http.post<{ data: Plan }>(`${this.api}/admin/plans`, plan)
      : this.http.put<{ data: Plan }>(`${this.api}/admin/plans/${plan.id}`, plan);
    req.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => { this.cancelEdit(); this.loadPlans(); },
      error: e => this.error.set(e.error?.detail || 'Error al guardar'),
    });
  }

  toggle(id: number): void {
    this.http.post<{ data: { is_active: boolean } }>(`${this.api}/admin/plans/${id}/toggle`, {})
      .subscribe({ next: () => this.loadPlans(), error: () => this.error.set('Error') });
  }

  featureLabel(key: string): string {
    const m: Record<string,string> = {
      enable_kpis:'KPIs', enable_reports:'Reportes', enable_realtime_tracking:'Tracking',
      enable_quotes:'Cotizaciones', enable_voice_reports:'Voz', enable_priority_support:'Soporte',
    };
    return m[key] || key;
  }

  getPlanFeature(plan: Plan, key: string): boolean {
    return (plan as any)[key] || false;
  }

  getEditingFeature(key: string): boolean {
    const plan = this.editing();
    if (!plan) return false;
    return (plan as any)[key] || false;
  }

  setEditingFeature(key: string, value: boolean): void {
    const plan = this.editing();
    if (plan) {
      (plan as any)[key] = value;
    }
  }
}
