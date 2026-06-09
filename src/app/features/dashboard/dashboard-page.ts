import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, effect } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MetricsService } from '../../core/services/metrics.service';
import { DashboardRealtimeService, DashboardMetrics } from '../../core/services/dashboard-realtime.service';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly metricsService = inject(MetricsService);
  private readonly realtimeService = inject(DashboardRealtimeService);

  readonly user = this.authService.user;
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly metricsLoading = signal(false);

  readonly displayName = computed(() => {
    const currentUser = this.user();
    if (!currentUser) {
      return 'Usuario';
    }
    if (currentUser.workshop_name) {
      return currentUser.workshop_name;
    }
    const fullName = `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim();
    if (fullName.length > 0) {
      return fullName;
    }
    return currentUser.email;
  });

  readonly userTypeLabel = computed(() => {
    const currentType = this.user()?.user_type ?? '';
    if (currentType === 'workshop') return 'Taller';
    if (currentType === 'client') return 'Cliente';
    if (currentType === 'technician') return 'Tecnico';
    if (currentType === 'administrator' || currentType === 'admin') return 'Administrador';
    return 'Usuario';
  });

  readonly isAdmin = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'admin' || userType === 'administrator';
  });

  readonly isWorkshop = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'workshop';
  });

  readonly twoFactorStatus = computed(() => {
    const currentUser = this.user();
    return Boolean(currentUser?.two_factor_enabled ?? currentUser?.mfa_enabled);
  });

  readonly liveMetrics = this.realtimeService.metrics;
  readonly incidentCounts = this.realtimeService.incidentCounts;

  readonly activeIncidents = computed(() => {
    const ws = this.liveMetrics();
    return ws.activeIncidents > 0 ? ws.activeIncidents : 0;
  });

  readonly completedToday = computed(() => {
    const ws = this.liveMetrics();
    return ws.completedToday > 0 ? ws.completedToday : 0;
  });

  readonly responseTime = computed(() => {
    const ws = this.liveMetrics();
    return ws.averageResponseTime > 0 ? ws.averageResponseTime : null;
  });

  readonly activeTechs = computed(() => {
    const ws = this.liveMetrics();
    return ws.activeTechnicians > 0 ? ws.activeTechnicians : 0;
  });

  readonly formatResponseTime = computed(() => {
    const time = this.responseTime();
    if (time === null || time <= 0) return '--';
    if (time < 1) return '< 1 min';
    return `${Math.round(time)} min`;
  });

  constructor() {
    effect(() => {
      this.realtimeService.metrics();
    });
  }

  ngOnInit(): void {
    if (this.user()) {
      this.loadDashboardMetrics();
      return;
    }

    this.isLoading.set(true);
    this.authService
      .fetchCurrentUser()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.loadDashboardMetrics();
        },
        error: () => {
          this.errorMessage.set('No fue posible cargar la sesion actual. Inicia sesion nuevamente.');
        },
      });
  }

  private loadDashboardMetrics(): void {
    const currentUser = this.user();
    if (!currentUser) return;

    this.metricsLoading.set(true);

    if (this.isAdmin()) {
      this.metricsService.getSystemMetrics().subscribe({
        next: (data: any) => {
          if (data) {
            this.realtimeService.metrics.set({
              activeIncidents: data?.incidents?.total ?? 0,
              pendingIncidents: data?.incidents?.by_state?.pendiente ?? 0,
              completedToday: 0,
              activeTechnicians: data?.resources?.active_technicians ?? 0,
              averageResponseTime: data?.performance?.avg_response_time_minutes ?? 0,
              updatedAt: new Date().toISOString(),
            });
          }
          this.metricsLoading.set(false);
        },
        error: () => {
          this.metricsLoading.set(false);
        },
      });
    } else if (this.isWorkshop()) {
      const workshopId = currentUser.id;
      this.metricsService.getWorkshopMetrics(workshopId).subscribe({
        next: (data: any) => {
          if (data) {
            const total = data?.incidents?.total ?? 0;
            const resolved = data?.incidents?.resolved ?? 0;
            const active = data?.incidents?.active ?? 0;
            this.realtimeService.metrics.set({
              activeIncidents: active,
              pendingIncidents: total - resolved - active,
              completedToday: 0,
              activeTechnicians: data?.technicians?.active ?? 0,
              averageResponseTime: data?.performance?.avg_response_time_minutes ?? 0,
              updatedAt: new Date().toISOString(),
            });
          }
          this.metricsLoading.set(false);
        },
        error: () => {
          this.metricsLoading.set(false);
        },
      });
    } else {
      this.metricsLoading.set(false);
    }
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
