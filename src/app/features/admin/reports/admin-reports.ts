import { Component, ChangeDetectionStrategy, inject, signal, OnInit, DestroyRef, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { MetricsService, FinancialReport } from '../../../core/services/metrics.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  template: `
    <div class="reports-container">
      <header class="reports-header">
        <div class="header-content">
          <h1>Dashboard de Plataforma</h1>
          <p class="subtitle">Visión global de incidentes, desempeño y finanzas de MecánicoYa.</p>
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
          <span class="kpi-label">Total Incidentes</span>
          <span class="kpi-value">{{ systemMetrics()?.incidents?.total || 0 }}</span>
          <div class="kpi-trend">En el período</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Comisiones Generadas</span>
          <span class="kpi-value">Bs. {{ (financial()?.summary?.total_commission || 0) | number:'1.2-2' }}</span>
          <div class="kpi-trend positive">Ingreso para plataforma</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Talleres Activos</span>
          <span class="kpi-value">{{ systemMetrics()?.resources?.active_workshops || 0 }}</span>
          <div class="kpi-trend">En el ecosistema</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tasa de Éxito Asignación</span>
          <span class="kpi-value">{{ systemMetrics()?.performance?.assignment_success_rate || 0 }}%</span>
          <div class="kpi-trend">Eficiencia de despacho</div>
        </div>
      </div>

      <!-- Reports Area -->
      <div class="reports-main">
        <section class="report-section">
          <div class="section-header">
            <h2>Rendimiento de Talleres</h2>
            <div class="actions">
              <button class="btn-export pdf" (click)="export('performance', 'pdf')">PDF</button>
              <button class="btn-export excel" (click)="export('performance', 'excel')">Excel</button>
            </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Taller</th>
                  <th>Incidentes</th>
                  <th>Respuesta</th>
                  <th>Resolución</th>
                </tr>
              </thead>
              <tbody>
                @for (p of performance(); track p.workshop_id) {
                  <tr>
                    <td class="font-bold">{{ p.name }}</td>
                    <td>{{ p.total_incidents }}</td>
                    <td>{{ p.avg_response_min }} min</td>
                    <td>{{ p.avg_resolution_min }} min</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="report-section">
          <div class="section-header">
            <h2>Estado Financiero Global</h2>
            <div class="actions">
              <button class="btn-export pdf" (click)="export('financial', 'pdf')">PDF</button>
            </div>
          </div>
          
          <div class="financial-summary">
            @if (financial(); as f) {
              <div class="chart-placeholder">
                <!-- Aquí iría un gráfico de torta con Chart.js -->
                <div class="stat-box">
                  <span class="label">Volumen Total Transaccionado</span>
                  <span class="value big">Bs. {{ f.summary.total_collected | number:'1.2-2' }}</span>
                </div>
                <div class="stat-box">
                  <span class="label">Liquidado a Talleres</span>
                  <span class="value">Bs. {{ f.summary.total_withdrawn | number:'1.2-2' }}</span>
                </div>
                <div class="stat-box">
                  <span class="label">Transacciones</span>
                  <span class="value">{{ f.summary.transaction_count }}</span>
                </div>
              </div>
            }
          </div>
        </section>

        <section class="report-section full-width">
          <div class="section-header">
            <h2>Métricas Visuales</h2>
          </div>
          <div class="admin-charts">
            <div class="admin-chart-box">
              <h3>Incidentes por Categoría</h3>
              <div class="chart-wrapper">
                <canvas baseChart
                  [data]="categoryChartData"
                  [type]="'pie'"
                  [options]="pieChartOptions">
                </canvas>
              </div>
            </div>
            <div class="admin-chart-box">
              <h3>Rendimiento de Talleres (Top 5)</h3>
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

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 3rem; }
    .kpi-card { background: var(--surface); padding: 1.5rem; border-radius: 20px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); }
    .kpi-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
    .kpi-value { display: block; font-size: 1.75rem; font-weight: 700; color: var(--text-main); font-family: var(--font-display); }
    .kpi-trend { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; }
    .kpi-trend.positive { color: var(--success); }

    .reports-main { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
    .report-section { background: var(--surface); padding: 2rem; border-radius: 24px; border: 1px solid var(--border-light); box-shadow: var(--shadow-md); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .section-header h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }
    
    .btn-export { padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: none; cursor: pointer; margin-left: 8px; }
    .btn-export.pdf { background: #fee2e2; color: #991b1b; }
    .btn-export.excel { background: #dcfce7; color: #166534; }

    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 1rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-light); }
    td { padding: 1rem; font-size: 0.85rem; border-bottom: 1px solid #f8fafc; }
    .font-bold { font-weight: 700; color: var(--text-main); }

    .stat-box { margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 12px; }
    .stat-box .label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px; }
    .stat-box .value { display: block; font-size: 1.25rem; font-weight: 700; }
    .stat-box .value.big { font-size: 1.75rem; color: var(--primary); }

    @media (max-width: 1024px) {
      .reports-main { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .full-width { grid-column: 1 / -1; }
    .admin-charts { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; }
    .admin-chart-box { background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border-light); }
    .admin-chart-box h3 { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 1.5rem; text-transform: uppercase; }
    .chart-wrapper { height: 300px; position: relative; }
  `
})
export class AdminReportsComponent implements OnInit {
  private metricsService = inject(MetricsService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  startDate = '';
  endDate = '';
  
  systemMetrics = signal<any>(null);
  financial = signal<FinancialReport | null>(null);
  performance = signal<any[]>([]);

  constructor() {
    effect(() => {
      const perf = this.performance();
      const cats = this.categoryDataSignal();
      
      if (perf.length > 0) {
        this.updatePerformanceChart(perf);
      }
      if (cats.length > 0) {
        this.updateCategoryChart(cats);
      }
      
      if (perf.length > 0 || cats.length > 0) {
        this.cdr.markForCheck();
      }
    });
  }

  // Chart data
  categoryChartData: ChartData<'pie'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336'] }]
  };

  performanceChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ label: 'Incidentes Atendidos', data: [], backgroundColor: '#6366f1' }]
  };

  categoryDataSignal = signal<any[]>([]);

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  };

  ngOnInit() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    this.startDate = start.toISOString().split('T')[0];
    this.endDate = end.toISOString().split('T')[0];

    this.refreshData();
  }

  refreshData() {
    this.metricsService.getSystemMetrics(this.startDate, this.endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.systemMetrics.set(data));

    this.metricsService.getFinancialReport(this.startDate, this.endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.financial.set(data));

    this.metricsService.getPerformanceReport(this.startDate, this.endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.performance.set(data);
      });

    this.metricsService.getIncidentsByCategory(this.startDate, this.endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.categoryDataSignal.set(data.categories || []);
      });
  }

  updateCategoryChart(data: any[]) {
    this.categoryChartData = {
      labels: data.map(d => d.category_name),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336', '#00bcd4', '#ffeb3b']
      }]
    };
  }

  updatePerformanceChart(data: any[]) {
    const top5 = [...data].sort((a, b) => b.total_incidents - a.total_incidents).slice(0, 5);
    this.performanceChartData = {
      labels: top5.map(t => t.name),
      datasets: [{
        label: 'Incidentes Atendidos',
        data: top5.map(t => t.total_incidents),
        backgroundColor: '#6366f1'
      }]
    };
  }

  export(type: 'incident' | 'financial' | 'performance', format: 'pdf' | 'excel') {
    this.metricsService.exportReport(type, format, this.startDate, this.endDate);
  }
}
