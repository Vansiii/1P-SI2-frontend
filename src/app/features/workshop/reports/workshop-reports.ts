import { Component, ChangeDetectionStrategy, inject, signal, OnInit, DestroyRef, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import {
  MetricsService,
  FinancialReport,
  PerformanceReport,
  IncidentReport,
  WorkshopKPIDashboard,
  KPIByType,
  KPIHotspot,
} from '../../../core/services/metrics.service';
import { AuthService } from '../../../core/services/auth.service';
import { IncidentHeatmapComponent } from '../../../shared/components/incident-heatmap/incident-heatmap';
import { VoiceCommandButtonComponent, VoiceCommandOutput } from '../../../shared/components/voice-command-button/voice-command-button';

@Component({
  selector: 'app-workshop-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BaseChartDirective, IncidentHeatmapComponent, VoiceCommandButtonComponent],
  providers: [provideCharts(withDefaultRegisterables())],
  template: `
    <div class="reports-container">
      <header class="reports-header">
        <div class="header-content">
          <h1>Reportes y Métricas</h1>
          <p class="section-subtitle">
            Analiza el desempeño de tu taller y tus estados financieros.
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
          <app-voice-command-button (commandResult)="onVoiceCommand($event)" />
          <button class="btn-refresh" (click)="refreshData()" aria-label="Actualizar datos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          </button>
        </div>
      </header>

      <!-- Voice command chips -->
      <div class="voice-chips-panel">
        <span class="voice-chips-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Comandos de voz:</span>
        <button class="voice-chip" (click)="export('financial','pdf')" title="Decir: exportar reporte financiero en PDF">"financiero PDF"</button>
        <button class="voice-chip" (click)="export('financial','excel')" title="Decir: exportar reporte financiero en Excel">"financiero Excel"</button>
        <button class="voice-chip" (click)="export('incident','pdf')" title="Decir: exportar incidentes en PDF">"incidentes PDF"</button>
        <button class="voice-chip" (click)="export('incident','excel')" title="Decir: exportar incidentes en Excel">"incidentes Excel"</button>
        <button class="voice-chip" (click)="export('performance','pdf')" title="Decir: exportar rendimiento en PDF">"rendimiento PDF"</button>
        <button class="voice-chip" (click)="export('performance','excel')" title="Decir: exportar rendimiento en Excel">"rendimiento Excel"</button>
      </div>

      <!-- KPI Grid (7 cards) -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Incidentes Resueltos</span>
          <span class="kpi-value">{{ performance()?.total_incidents || 0 }}</span>
          <div class="kpi-trend positive">En el período seleccionado</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tiempo de Asignacion</span>
          <span class="kpi-value">{{ kpiDashboard()?.kpi_asignacion?.promedio_minutos || 0 }} min</span>
          <div class="kpi-trend">Reporte &#8594; taller asignado</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tiempo de Llegada</span>
          <span class="kpi-value">{{ kpiDashboard()?.kpi_llegada?.promedio_minutos || 0 }} min</span>
          <div class="kpi-trend">Asignacion &#8594; llegada al sitio</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Cumplimiento SLA</span>
          <span class="kpi-value" [class.text-success]="slaPct() >= 80" [class.text-warning]="slaPct() >= 60 && slaPct() < 80" [class.text-error]="slaPct() < 60">
            {{ slaPct() }}%
          </span>
          <div class="kpi-trend">{{ slaLabel() }}</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Casos Cancelados</span>
          <span class="kpi-value">{{ kpiDashboard()?.kpi_cancelados?.total_cancelados || 0 }}</span>
          <div class="kpi-trend">{{ kpiDashboard()?.kpi_cancelados?.tasa_cancelacion_pct || 0 }}% del total</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tipo Mas Frecuente</span>
          <span class="kpi-value">{{ topType() }}</span>
          <div class="kpi-trend">{{ topTypeCount() }} incidentes</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Ingresos Netos</span>
          <span class="kpi-value">Bs. {{ financial()?.summary?.total_workshop_net | number:'1.2-2' }}</span>
          <div class="kpi-trend">Despues de comisiones</div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="charts-row">
        <div class="chart-box">
          <h3>Distribucion por Tipo de Incidente</h3>
          <div class="chart-wrapper">
            <canvas baseChart [data]="typeChartData" [type]="'doughnut'" [options]="doughnutOptions"></canvas>
          </div>
        </div>
        <div class="chart-box">
          <h3>Tiempos de Servicio (min)</h3>
          <div class="chart-wrapper">
            <canvas baseChart [data]="timeChartData" [type]="'bar'" [options]="barChartOptions"></canvas>
          </div>
        </div>
        <div class="chart-box">
          <h3>Indicador SLA</h3>
          <div class="sla-gauge-container">
            <div class="sla-gauge" [class.gauge-green]="slaPct() >= 80" [class.gauge-yellow]="slaPct() >= 60 && slaPct() < 80" [class.gauge-red]="slaPct() < 60">
              <span class="gauge-value">{{ slaPct() }}%</span>
            </div>
            <div class="sla-details">
              <div>Dentro de SLA: <strong>{{ kpiDashboard()?.kpi_sla?.dentro_de_sla || 0 }}</strong></div>
              <div>Fuera de SLA: <strong>{{ kpiDashboard()?.kpi_sla?.fuera_de_sla || 0 }}</strong></div>
              <div>Tiempo esperado: <strong>{{ kpiDashboard()?.kpi_sla?.tiempo_esperado_promedio_min || 60 }} min</strong></div>
            </div>
          </div>
        </div>
      </div>

      @if (kpiDashboard()?.kpi_cancelados?.motivos?.length) {
      <div class="charts-row">
        <div class="chart-box full-width">
          <h3>Motivos de Cancelacion</h3>
          <div class="chart-wrapper chart-horizontal">
            <canvas baseChart [data]="cancelChartData" [type]="'bar'" [options]="horizontalBarOptions"></canvas>
          </div>
        </div>
      </div>
      }

      <!-- Heatmap de zonas criticas -->
      @if (kpiDashboard()?.kpi_zonas?.length) {
      <div class="heatmap-section">
        <div class="section-header">
          <h2>Zonas con Mas Incidentes</h2>
        </div>
        <app-incident-heatmap [hotspots]="kpiDashboard()?.kpi_zonas || []" height="420px" />
      </div>
      }

      <!-- Financial + Incident Table -->
      <div class="reports-main">
        <section class="report-section">
          <div class="section-header">
            <h2>Resumen Financiero</h2>
            <div class="actions">
              <button class="btn-export pdf" (click)="export('financial', 'pdf')">PDF</button>
              <button class="btn-export excel" (click)="export('financial', 'excel')">Excel</button>
            </div>
          </div>
          @if (financial(); as f) {
          <div class="financial-details">
            <div class="detail-row">
              <span>Total Recaudado (Clientes):</span>
              <span class="val">Bs. {{ f.summary.total_collected | number:'1.2-2' }}</span>
            </div>
            <div class="detail-row">
              <span>Comision de Plataforma (10%):</span>
              <span class="val negative">- Bs. {{ f.summary.total_commission | number:'1.2-2' }}</span>
            </div>
            <hr />
            <div class="detail-row total">
              <span>Ganancia Neta:</span>
              <span class="val positive">Bs. {{ f.summary.total_workshop_net | number:'1.2-2' }}</span>
            </div>
          </div>
          }
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
                  <th>Categoria</th>
                  <th>Estado</th>
                  <th>Direccion</th>
                </tr>
              </thead>
              <tbody>
                @for (inc of incidents(); track inc.id) {
                <tr>
                  <td>{{ inc.created_at | date:'dd/MM/yyyy' }}</td>
                  <td>{{ inc.categoria_ia || 'N/A' }}</td>
                  <td><span class="status-pill" [class]="'pill-' + inc.estado_actual">{{ inc.estado_actual }}</span></td>
                  <td class="truncate">{{ inc.direccion_referencia }}</td>
                </tr>
                } @empty {
                <tr><td colspan="4" class="empty">No hay incidentes en este periodo.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .reports-container { padding: 2rem; max-width: 1400px; margin: 0 auto; }
    .reports-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; gap: 2rem; }
    .header-content h1 { font-size: 2.25rem; font-weight: 700; margin: 0; letter-spacing: -0.025em; }
    .section-subtitle { color: var(--text-muted); margin-top: 0.5rem; font-size: 0.9rem; }

    .voice-chips-panel {
      display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;
      padding: 0.65rem 1rem; margin-bottom: 1.5rem;
    }
    .voice-chips-label {
      font-size: 0.75rem; font-weight: 700; color: #1e40af; display: flex; align-items: center; gap: 4px;
      margin-right: 0.25rem;
    }
    .voice-chip {
      background: white; border: 1px solid #bfdbfe; border-radius: 8px;
      padding: 4px 10px; font-size: 0.7rem; font-weight: 600;
      color: #1e40af; cursor: pointer; transition: all 0.15s;
    }
    .voice-chip:hover { background: #1e40af; color: white; border-color: #1e40af; }

    .date-filters { display: flex; gap: 1rem; align-items: flex-end; background: var(--surface); padding: 1rem; border-radius: 16px; border: 1px solid var(--border-light); }
    .date-filters .field { display: flex; flex-direction: column; gap: 4px; }
    .date-filters label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
    .date-filters input { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-light); background: #f8fafc; font-weight: 500; }
    .btn-refresh { background: var(--primary); color: white; border: none; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-refresh svg { width: 20px; height: 20px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 2rem; }
    .kpi-card { background: var(--surface); padding: 1.25rem; border-radius: 20px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); }
    .kpi-label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
    .kpi-value { display: block; font-size: 1.7rem; font-weight: 700; color: var(--text-main); font-family: var(--font-display); }
    .kpi-trend { font-size: 0.7rem; color: var(--text-muted); margin-top: 6px; }
    .kpi-trend.positive { color: var(--success); }
    .text-success { color: var(--success); }
    .text-warning { color: #eab308; }
    .text-error { color: var(--error); }

    .charts-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem; }
    .chart-box { background: var(--surface); padding: 1.5rem; border-radius: 20px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); }
    .chart-box h3 { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 1rem; text-transform: uppercase; }
    .chart-box.full-width { grid-column: 1 / -1; }
    .chart-wrapper { height: 260px; position: relative; }
    .chart-wrapper.chart-horizontal { height: 300px; }
    .hide { display: none; }

    .sla-gauge-container { display: flex; align-items: center; gap: 1.5rem; }
    .sla-gauge {
      width: 120px; height: 120px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 8px solid var(--border-light); transition: border-color 0.3s;
    }
    .gauge-green { border-color: var(--success); background: #dcfce7; }
    .gauge-yellow { border-color: #eab308; background: #fefce8; }
    .gauge-red { border-color: var(--error); background: #fee2e2; }
    .gauge-value { font-size: 1.8rem; font-weight: 800; font-family: var(--font-display); }
    .sla-details { font-size: 0.8rem; line-height: 1.8; }
    .sla-details strong { color: var(--text-main); }

    .heatmap-section { margin-bottom: 2rem; }
    .heatmap-section .section-header { margin-bottom: 1rem; }

    .reports-main { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; }
    .report-section { background: var(--surface); padding: 2rem; border-radius: 24px; border: 1px solid var(--border-light); box-shadow: var(--shadow-md); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .section-header h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }

    .btn-export { padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: none; cursor: pointer; margin-left: 8px; }
    .btn-export.pdf { background: #fee2e2; color: #991b1b; }
    .btn-export.excel { background: #dcfce7; color: #166534; }

    .financial-details .detail-row { display: flex; justify-content: space-between; padding: 0.8rem 0; font-weight: 500; }
    .financial-details hr { border: 0; border-top: 1px solid var(--border-light); margin: 0.3rem 0; }
    .detail-row.total { font-size: 1.05rem; font-weight: 700; }
    .val.positive { color: var(--success); }
    .val.negative { color: var(--error); }

    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 0.8rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-light); }
    td { padding: 0.8rem; font-size: 0.85rem; border-bottom: 1px solid #f8fafc; }
    .truncate { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { text-align: center; color: var(--text-muted); padding: 2rem !important; }

    .status-pill { padding: 4px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .pill-resuelto { background: #dcfce7; color: #166534; }
    .pill-cancelado { background: #fee2e2; color: #991b1b; }
    .pill-en_proceso { background: #eff6ff; color: #1e40af; }
    .pill-pendiente { background: #fefce8; color: #854d0e; }
    .pill-asignado { background: #f3e8ff; color: #6b21a8; }

    @media (max-width: 1200px) {
      .kpi-grid { grid-template-columns: repeat(3, 1fr); }
      .charts-row { grid-template-columns: repeat(2, 1fr); }
      .reports-main { grid-template-columns: 1fr; }
      .reports-header { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
    }
  `
})
export class WorkshopReportsComponent implements OnInit {
  private metricsService = inject(MetricsService);
  public authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  startDate = '';
  endDate = '';

  financial = signal<FinancialReport | null>(null);
  performance = signal<PerformanceReport | null>(null);
  incidents = signal<IncidentReport[]>([]);
  kpiDashboard = signal<WorkshopKPIDashboard | null>(null);
  isLoading = signal(false);

  // Computed signals
  slaPct = (): number => this.kpiDashboard()?.kpi_sla?.cumplimiento_sla_pct ?? 0;

  slaLabel(): string {
    const pct = this.slaPct();
    if (pct >= 80) return 'Excelente';
    if (pct >= 60) return 'Aceptable';
    if (pct > 0) return 'Requiere atencion';
    return 'Sin datos';
  }

  topType(): string {
    const tipos = this.kpiDashboard()?.kpi_tipos;
    return tipos?.length ? tipos[0].tipo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
  }

  topTypeCount(): number {
    const tipos = this.kpiDashboard()?.kpi_tipos;
    return tipos?.length ? tipos[0].total : 0;
  }

  // Charts data
  typeChartData: ChartData<'doughnut'> = { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  timeChartData: ChartData<'bar'> = { labels: ['Asignacion', 'Llegada', 'Resolucion SLA'], datasets: [{ label: 'Minutos', data: [0, 0, 0], backgroundColor: ['#6366f1', '#f97316', '#a855f7'] }] };
  cancelChartData: ChartData<'bar'> = { labels: [], datasets: [{ label: 'Cancelaciones', data: [], backgroundColor: '#ef4444' }] };

  doughnutOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } };
  barChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } };
  horizontalBarOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { beginAtZero: true } } };

  constructor() {
    effect(() => {
      const kpi = this.kpiDashboard();
      if (kpi) {
        this.updateAllCharts(kpi);
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    this.startDate = start.toISOString().split('T')[0];
    this.endDate = end.toISOString().split('T')[0];
    this.refreshData();
  }

  refreshData() {
    const user = this.authService.currentUser();
    let workshopId = user?.workshop_id || user?.id;
    if (!workshopId) return;

    this.isLoading.set(true);

    // Unified KPI dashboard
    this.metricsService.getWorkshopKPIDashboard(workshopId, this.startDate, this.endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          // Fix: the dashboard service returns partial data; remap properly
          if (typeof data === 'object' && data !== null) {
            // The API wraps in { data: ... } but our pipe maps it already
            this.kpiDashboard.set(data);
          }
        },
        error: (err) => console.error('Error KPI dashboard:', err)
      });

    // Financial
    this.metricsService.getFinancialReport(this.startDate, this.endDate, workshopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.financial.set(data),
        error: (err) => console.error('Error financial:', err)
      });

    // Performance
    this.metricsService.getPerformanceReport(this.startDate, this.endDate, workshopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.performance.set(data[0] || null),
        error: (err) => console.error('Error performance:', err)
      });

    // Incidents list
    this.metricsService.getIncidentReport(this.startDate, this.endDate, undefined, undefined, workshopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => { this.incidents.set(data); this.isLoading.set(false); },
        error: (err) => { console.error('Error incidents:', err); this.isLoading.set(false); }
      });
  }

  updateAllCharts(kpi: WorkshopKPIDashboard) {
    // Type doughnut
    const tipos = kpi.kpi_tipos || [];
    this.typeChartData = {
      labels: tipos.map(t => t.tipo.replace(/_/g, ' ')),
      datasets: [{
        data: tipos.map(t => t.total),
        backgroundColor: ['#f97316', '#6366f1', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'],
      }]
    };

    // Time bar
    this.timeChartData = {
      labels: ['Asignacion', 'Llegada', 'Resolucion (SLA)'],
      datasets: [{
        label: 'Minutos',
        data: [
          kpi.kpi_asignacion?.promedio_minutos ?? 0,
          kpi.kpi_llegada?.promedio_minutos ?? 0,
          kpi.kpi_sla?.tiempo_promedio_real_min ?? 0,
        ],
        backgroundColor: ['#6366f1', '#f97316', '#a855f7'],
      }]
    };

    // Cancellation reasons bar (horizontal)
    const motivos = kpi.kpi_cancelados?.motivos || [];
    this.cancelChartData = {
      labels: motivos.map(m => m.motivo),
      datasets: [{
        label: 'Cancelaciones',
        data: motivos.map(m => m.total),
        backgroundColor: '#ef4444',
      }]
    };
  }

  export(type: 'incident' | 'financial' | 'performance', format: 'pdf' | 'excel') {
    const workshopId = this.authService.currentUser()?.id;
    this.metricsService.exportReport(type, format, this.startDate, this.endDate, workshopId);
  }

  onVoiceCommand(result: VoiceCommandOutput): void {
    const cmd = result.comando;
    const text = (result.texto_transcrito || '').toLowerCase();
    const wantsPdf = text.includes('pdf');
    const wantsExcel = text.includes('excel');
    const fmt: 'pdf' | 'excel' = wantsPdf ? 'pdf' : wantsExcel ? 'excel' : 'pdf';

    if (text.includes('financiero') || text.includes('finanzas') || text.includes('ingresos') || text.includes('comisión') || cmd.type === 'financial') {
      this.export('financial', fmt);
    } else if (text.includes('incidente') || text.includes('emergencia') || text.includes('servicio') || cmd.type === 'my_incidents') {
      this.export('incident', fmt);
    } else if (text.includes('rendimiento') || text.includes('desempeño') || text.includes('performance') || text.includes('eficiencia') || cmd.type === 'efficiency') {
      this.export('performance', fmt);
    } else if (text.includes('kpi') || text.includes('dashboard') || text.includes('métrica')) {
      this.refreshData();
    } else {
      this.export('financial', fmt);
    }
  }
}
