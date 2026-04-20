import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { MetricsService } from '../../core/services/metrics.service';

@Component({
  selector: 'app-metrics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h1>Dashboard de Métricas</h1>
        <div class="filters">
          <select [(ngModel)]="selectedPeriod" (change)="loadMetrics()" class="filter-select">
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
          <button class="btn-refresh" (click)="loadMetrics()">
            <i class="icon-refresh"></i> Actualizar
          </button>
        </div>
      </div>

      <div *ngIf="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Cargando métricas...</p>
      </div>

      <div *ngIf="!isLoading" class="dashboard-content">
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon" style="background: #4caf50;">
              <i class="icon-check-circle"></i>
            </div>
            <div class="kpi-content">
              <h3>{{ systemMetrics?.total_incidents || 0 }}</h3>
              <p>Total Incidentes</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon" style="background: #2196f3;">
              <i class="icon-clock"></i>
            </div>
            <div class="kpi-content">
              <h3>{{ formatMinutes(systemMetrics?.avg_response_time_minutes) }}</h3>
              <p>Tiempo Promedio de Respuesta</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon" style="background: #ff9800;">
              <i class="icon-timer"></i>
            </div>
            <div class="kpi-content">
              <h3>{{ formatMinutes(systemMetrics?.avg_resolution_time_minutes) }}</h3>
              <p>Tiempo Promedio de Resolución</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon" style="background: #9c27b0;">
              <i class="icon-users"></i>
            </div>
            <div class="kpi-content">
              <h3>{{ systemMetrics?.active_technicians || 0 }}</h3>
              <p>Técnicos Activos</p>
            </div>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
          <!-- Incidents by Category -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Incidentes por Categoría</h3>
            </div>
            <div class="chart-body">
              <canvas baseChart
                [data]="categoryChartData"
                [type]="'pie'"
                [options]="pieChartOptions">
              </canvas>
            </div>
          </div>

          <!-- Response Time Trend -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Tendencia de Tiempo de Respuesta</h3>
            </div>
            <div class="chart-body">
              <canvas baseChart
                [data]="responseTimeChartData"
                [type]="'line'"
                [options]="lineChartOptions">
              </canvas>
            </div>
          </div>

          <!-- Technicians Performance -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Rendimiento de Técnicos</h3>
            </div>
            <div class="chart-body">
              <canvas baseChart
                [data]="techniciansChartData"
                [type]="'bar'"
                [options]="barChartOptions">
              </canvas>
            </div>
          </div>

          <!-- Resolution Rate -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Tasa de Resolución</h3>
            </div>
            <div class="chart-body">
              <div class="resolution-stats">
                <div class="stat-item">
                  <div class="stat-value">{{ systemMetrics?.resolution_rate || 0 }}%</div>
                  <div class="stat-label">Tasa de Resolución</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ systemMetrics?.active_workshops || 0 }}</div>
                  <div class="stat-label">Talleres Activos</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ systemMetrics?.assignment_success_rate || 0 }}%</div>
                  <div class="stat-label">Éxito de Asignación</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Export Actions -->
        <div class="export-actions">
          <button class="btn-export" (click)="exportToPDF()">
            <i class="icon-pdf"></i> Exportar a PDF
          </button>
          <button class="btn-export" (click)="exportToExcel()">
            <i class="icon-excel"></i> Exportar a Excel
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      background: #f5f5f5;
      min-height: 100vh;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .dashboard-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      color: #333;
    }

    .filters {
      display: flex;
      gap: 12px;
    }

    .filter-select {
      padding: 8px 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      background: white;
      cursor: pointer;
    }

    .btn-refresh {
      padding: 8px 16px;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }

    .btn-refresh:hover {
      background: #1976d2;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #2196f3;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .kpi-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
    }

    .kpi-content h3 {
      margin: 0 0 4px 0;
      font-size: 28px;
      font-weight: 700;
      color: #333;
    }

    .kpi-content p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .chart-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .chart-header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e0e0e0;
    }

    .chart-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .chart-body {
      min-height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .resolution-stats {
      display: flex;
      justify-content: space-around;
      width: 100%;
      padding: 20px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #2196f3;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
    }

    .export-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn-export {
      padding: 10px 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-export:hover {
      background: #f5f5f5;
      border-color: #2196f3;
      color: #2196f3;
    }
  `]
})
export class MetricsDashboardComponent implements OnInit {
  selectedPeriod: string = '30';
  isLoading: boolean = true;
  systemMetrics: any = null;
  categoryMetrics: any[] = [];

  // Chart data
  categoryChartData: ChartData<'pie'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#4caf50',
        '#2196f3',
        '#ff9800',
        '#9c27b0',
        '#f44336',
        '#00bcd4',
        '#ffeb3b',
        '#795548'
      ]
    }]
  };

  responseTimeChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Tiempo de Respuesta (min)',
      data: [],
      borderColor: '#2196f3',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      tension: 0.4
    }]
  };

  techniciansChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Incidentes Resueltos',
      data: [],
      backgroundColor: '#4caf50'
    }]
  };

  // Chart options
  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right'
      }
    }
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  constructor(private metricsService: MetricsService) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.isLoading = true;

    // Load system metrics
    this.metricsService.getSystemMetrics().subscribe({
      next: (response) => {
        this.systemMetrics = response.data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading system metrics:', error);
        this.isLoading = false;
      }
    });

    // Load category metrics
    this.metricsService.getIncidentsByCategory().subscribe({
      next: (response) => {
        this.categoryMetrics = response.data;
        this.updateCategoryChart();
      },
      error: (error) => {
        console.error('Error loading category metrics:', error);
      }
    });

    // Load response time series
    this.metricsService.getResponseTimeSeries(parseInt(this.selectedPeriod)).subscribe({
      next: (response) => {
        this.updateResponseTimeChart(response.data);
      },
      error: (error) => {
        console.error('Error loading response time series:', error);
      }
    });

    // Load technician performance (example with workshop_id = 1)
    // TODO: Get actual workshop_id from current user
    const workshopId = 1;
    this.metricsService.getTechnicianPerformance(workshopId, parseInt(this.selectedPeriod)).subscribe({
      next: (response) => {
        this.updateTechniciansChart(response.data);
      },
      error: (error) => {
        console.error('Error loading technician performance:', error);
      }
    });
  }

  updateCategoryChart(): void {
    this.categoryChartData = {
      labels: this.categoryMetrics.map(c => c.category_name),
      datasets: [{
        data: this.categoryMetrics.map(c => c.count),
        backgroundColor: [
          '#4caf50',
          '#2196f3',
          '#ff9800',
          '#9c27b0',
          '#f44336',
          '#00bcd4',
          '#ffeb3b',
          '#795548'
        ]
      }]
    };
  }

  updateResponseTimeChart(data: any[]): void {
    this.responseTimeChartData = {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Tiempo de Respuesta (min)',
        data: data.map(d => d.value),
        borderColor: '#2196f3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        tension: 0.4
      }]
    };
  }

  updateTechniciansChart(data: any[]): void {
    this.techniciansChartData = {
      labels: data.map(t => t.technician_name),
      datasets: [{
        label: 'Incidentes Resueltos',
        data: data.map(t => t.resolved_incidents),
        backgroundColor: '#4caf50'
      }]
    };
  }

  formatMinutes(minutes?: number): string {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  }

  exportToPDF(): void {
    // TODO: Implement PDF export using jsPDF
    console.log('Export to PDF not implemented yet');
    alert('Funcionalidad de exportación a PDF en desarrollo');
  }

  exportToExcel(): void {
    // TODO: Implement Excel export using xlsx
    console.log('Export to Excel not implemented yet');
    alert('Funcionalidad de exportación a Excel en desarrollo');
  }
}
