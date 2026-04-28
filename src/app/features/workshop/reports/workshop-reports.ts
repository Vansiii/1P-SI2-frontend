import { Component, ChangeDetectionStrategy, inject, signal, OnInit, DestroyRef, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { MetricsService, FinancialReport, PerformanceReport } from '../../../core/services/metrics.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-workshop-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  template: `
    <div class="reports-container">
      <header class="reports-header">
        <div class="header-content">
          <h1>Reportes y Métricas</h1>
          <p class="section-subtitle">
          Analiza el desempeño de tu taller y tus estados financieros.
          <small class="text-muted" style="font-size: 0.6rem; opacity: 0.5;">
            [Debug ID: {{ authService.currentUser()?.workshop_id || authService.currentUser()?.id }}]
          </small>
        </p>
        </div>
        
        <div class="date-filters">
          <div class="field">
            <label for="start-date">Desde</label>
            <input id="start-date" type="date" [(ngModel)]="startDate" (change)="refreshData()" />
          </div>
          <div class="field">
            <label for="end-date">Hasta</label>
            <input id="end-date" type="date" [(ngModel)]="endDate" (change)="refreshData()" />
          </div>
          <button class="btn-refresh" (click)="refreshData()" aria-label="Actualizar datos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          </button>
        </div>
      </header>

      <!-- KPI Grid -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Incidentes Resueltos</span>
          <span class="kpi-value">{{ performance()?.total_incidents || 0 }}</span>
          <div class="kpi-trend positive">En el período seleccionado</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Ingresos Netos</span>
          <span class="kpi-value">Bs. {{ financial()?.summary?.total_workshop_net | number:'1.2-2' }}</span>
          <div class="kpi-trend">Después de comisiones</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tiempo de Respuesta</span>
          <span class="kpi-value">{{ performance()?.avg_response_min || 0 }} min</span>
          <div class="kpi-trend">Promedio de asignación</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tiempo de Resolución</span>
          <span class="kpi-value">{{ performance()?.avg_resolution_min || 0 }} min</span>
          <div class="kpi-trend">Promedio de trabajo</div>
        </div>
      </div>

      <!-- Main Reports Area -->
      <div class="reports-main">
        <section class="report-section">
          <div class="section-header">
            <h2>Resumen Financiero</h2>
            <div class="actions">
              <button class="btn-export pdf" (click)="export('financial', 'pdf')">PDF</button>
              <button class="btn-export excel" (click)="export('financial', 'excel')">Excel</button>
            </div>
          </div>
          
          <div class="financial-details">
            @if (financial(); as f) {
              <div class="detail-row">
                <span>Total Recaudado (Clientes):</span>
                <span class="val">Bs. {{ f.summary.total_collected | number:'1.2-2' }}</span>
              </div>
              <div class="detail-row">
                <span>Comisión de Plataforma (10%):</span>
                <span class="val negative">- Bs. {{ f.summary.total_commission | number:'1.2-2' }}</span>
              </div>
              <hr />
              <div class="detail-row total">
                <span>Ganancia Neta:</span>
                <span class="val positive">Bs. {{ f.summary.total_workshop_net | number:'1.2-2' }}</span>
              </div>
            }
          </div>
        </section>

        <section class="report-section full-width">
          <div class="section-header">
            <h2>Visualización de Datos</h2>
          </div>
          
          <div class="charts-container">
            <div class="chart-box">
              <h3>Distribución por Estado</h3>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="statusChartData"
                  [type]="'pie'"
                  [options]="pieChartOptions">
                </canvas>
              </div>
            </div>
            
            <div class="chart-box">
              <h3>Tendencia de Respuesta (min)</h3>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="performanceChartData"
                  [type]="'bar'"
                  [options]="barChartOptions">
                </canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="report-section">
          <div class="section-header">
            <h2>Reporte de Incidentes</h2>
            <div class="actions">
              <button class="btn-export pdf" (click)="export('incident', 'pdf')">PDF</button>
              <button class="btn-export excel" (click)="export('incident', 'excel')">Excel</button>
            </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Dirección</th>
                </tr>
              </thead>
              <tbody>
                @for (inc of incidents(); track inc.id) {
                  <tr>
                    <td>{{ inc.created_at | date:'dd/MM/yyyy' }}</td>
                    <td>{{ inc.categoria_ia || 'N/A' }}</td>
                    <td>
                      <span class="status-pill" [class]="'pill-' + inc.estado_actual">
                        {{ inc.estado_actual }}
                      </span>
                    </td>
                    <td class="truncate">{{ inc.direccion_referencia }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="empty">No hay incidentes registrados en este período.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .reports-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    .reports-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; gap: 2rem; }
    .header-content h1 { font-size: 2.25rem; font-weight: 700; margin: 0; letter-spacing: -0.025em; }
    .subtitle { color: var(--text-muted); margin-top: 0.5rem; }

    .date-filters { display: flex; gap: 1rem; align-items: flex-end; background: var(--surface); padding: 1rem; border-radius: 16px; border: 1px solid var(--border-light); }
    .date-filters .field { display: flex; flex-direction: column; gap: 4px; }
    .date-filters label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
    .date-filters input { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-light); background: #f8fafc; font-weight: 500; }
    .btn-refresh { background: var(--primary); color: white; border: none; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-refresh svg { width: 20px; height: 20px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 3rem; }
    .kpi-card { background: var(--surface); padding: 1.5rem; border-radius: 20px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); }
    .kpi-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
    .kpi-value { display: block; font-size: 1.75rem; font-weight: 700; color: var(--text-main); font-family: var(--font-display); }
    .kpi-trend { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; }
    .kpi-trend.positive { color: var(--success); }

    .reports-main { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; }
    .report-section { background: var(--surface); padding: 2rem; border-radius: 24px; border: 1px solid var(--border-light); box-shadow: var(--shadow-md); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .section-header h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }
    
    .btn-export { padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: none; cursor: pointer; margin-left: 8px; }
    .btn-export.pdf { background: #fee2e2; color: #991b1b; }
    .btn-export.excel { background: #dcfce7; color: #166534; }

    .financial-details .detail-row { display: flex; justify-content: space-between; padding: 1rem 0; font-weight: 500; }
    .financial-details hr { border: 0; border-top: 1px solid var(--border-light); margin: 0.5rem 0; }
    .detail-row.total { font-size: 1.1rem; font-weight: 700; }
    .val.positive { color: var(--success); }
    .val.negative { color: var(--error); }

    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 1rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-light); }
    td { padding: 1rem; font-size: 0.85rem; border-bottom: 1px solid #f8fafc; }
    .truncate { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { text-align: center; color: var(--text-muted); padding: 3rem !important; }

    .status-pill { padding: 4px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .pill-resuelto { background: #dcfce7; color: #166534; }
    .pill-cancelado { background: #fee2e2; color: #991b1b; }
    .pill-en_proceso { background: #eff6ff; color: #1e40af; }

    @media (max-width: 1024px) {
      .reports-main { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .reports-header { flex-direction: column; align-items: flex-start; }
    }

    .full-width { grid-column: 1 / -1; }
    .charts-container { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; margin-top: 1rem; }
    .chart-box { background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border-light); }
    .chart-box h3 { font-size: 0.9rem; font-weight: 700; color: var(--text-muted); margin-bottom: 1.5rem; text-transform: uppercase; }
    .chart-wrapper { height: 250px; position: relative; }
  `
})
export class WorkshopReportsComponent implements OnInit {
  private metricsService = inject(MetricsService);
  public authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Automatically update charts when data changes
    effect(() => {
      const data = this.incidents();
      const perf = this.performance();
      if (data.length > 0 || perf) {
        this.updateCharts(data);
        this.cdr.markForCheck();
      }
    });
  }

  startDate = '';
  endDate = '';
  
  financial = signal<FinancialReport | null>(null);
  performance = signal<PerformanceReport | null>(null);
  incidents = signal<any[]>([]);
  isLoading = signal(false);

  // Charts data
  statusChartData: ChartData<'pie'> = {
    labels: ['Resuelto', 'En Proceso', 'Cancelado'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#4caf50', '#2196f3', '#f44336']
    }]
  };

  performanceChartData: ChartData<'bar'> = {
    labels: ['Respuesta', 'Resolución'],
    datasets: [{
      label: 'Minutos Promedio',
      data: [0, 0],
      backgroundColor: ['#6366f1', '#a855f7']
    }]
  };

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  };

  ngOnInit() {
    // Default range: last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    this.startDate = start.toISOString().split('T')[0];
    this.endDate = end.toISOString().split('T')[0];

    this.refreshData();
  }

  refreshData() {
    const user = this.authService.currentUser();
    const workshopId = user?.workshop_id || user?.id;
    if (!workshopId) return;

    this.isLoading.set(true);

    // Load Financial
    this.metricsService.getFinancialReport(this.startDate, this.endDate, workshopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.financial.set(data),
        error: (err) => console.error('Error financial report:', err)
      });

    // Load Performance
    this.metricsService.getPerformanceReport(this.startDate, this.endDate, workshopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.performance.set(data[0] || null),
        error: (err) => console.error('Error performance report:', err)
      });

    // Load Incidents List
    this.metricsService.getIncidentReport(this.startDate, this.endDate, undefined, undefined, workshopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.incidents.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error incident report:', err);
          this.isLoading.set(false);
        }
      });
  }

  updateCharts(incidents: any[]) {
    // Status Pie
    const statusCounts = {
      'resuelto': 0,
      'en_proceso': 0,
      'cancelado': 0
    };
    
    incidents.forEach(i => {
      const s = i.estado_actual as keyof typeof statusCounts;
      if (statusCounts[s] !== undefined) statusCounts[s]++;
    });

    this.statusChartData = {
      labels: ['Resuelto', 'En Proceso', 'Cancelado'],
      datasets: [{
        data: [statusCounts.resuelto, statusCounts.en_proceso, statusCounts.cancelado],
        backgroundColor: ['#4caf50', '#2196f3', '#f44336']
      }]
    };

    // Performance Bar
    const perf = this.performance();
    if (perf) {
      this.performanceChartData = {
        labels: ['Respuesta', 'Resolución'],
        datasets: [{
          label: 'Minutos Promedio',
          data: [perf.avg_response_min, perf.avg_resolution_min],
          backgroundColor: ['#6366f1', '#a855f7']
        }]
      };
    }
  }

  export(type: 'incident' | 'financial' | 'performance', format: 'pdf' | 'excel') {
    const workshopId = this.authService.currentUser()?.id;
    this.metricsService.exportReport(type, format, this.startDate, this.endDate, workshopId);
  }
}
