import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColorContrastService, ColorValidationReport } from '../../services/color-contrast.service';

/**
 * ColorContrastReportComponent
 * 
 * Development tool component for displaying WCAG color contrast compliance report.
 * Shows validation results for all color combinations used in the application.
 * 
 * Features:
 * - Real-time contrast ratio calculations
 * - WCAG AA compliance checking
 * - Visual color swatches
 * - Detailed compliance report
 * - Export functionality for accessibility audits
 * 
 * Requirements: 12.4
 */
@Component({
  selector: 'app-color-contrast-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="contrast-report">
      <div class="report-header">
        <h2 class="report-title">WCAG Color Contrast Report</h2>
        <div class="report-summary">
          <div class="summary-item" [class.success]="report().isCompliant" [class.error]="!report().isCompliant">
            <span class="summary-label">Status:</span>
            <span class="summary-value">{{ report().isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Checked:</span>
            <span class="summary-value">{{ report().totalChecked }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Valid:</span>
            <span class="summary-value success">{{ report().validCombinations.length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Issues:</span>
            <span class="summary-value" [class.error]="report().issues.length > 0">{{ report().issues.length }}</span>
          </div>
        </div>
        <button class="refresh-btn" (click)="refreshReport()" type="button">
          Refresh Report
        </button>
      </div>

      @if (report().issues.length > 0) {
        <div class="issues-section">
          <h3 class="section-title error">Contrast Issues</h3>
          <div class="issues-list">
            @for (issue of report().issues; track issue.name) {
              <div class="issue-item">
                <div class="color-swatch-pair">
                  <div class="color-swatch" [style.background-color]="issue.backgroundColor">
                    <span class="swatch-text" [style.color]="issue.textColor">Aa</span>
                  </div>
                  <div class="swatch-info">
                    <div class="swatch-label">{{ issue.type | titlecase }}: {{ issue.name }}</div>
                    <div class="swatch-colors">
                      <span>BG: {{ issue.backgroundColor }}</span>
                      <span>Text: {{ issue.textColor }}</span>
                    </div>
                  </div>
                </div>
                <div class="contrast-info">
                  <div class="contrast-ratio error">
                    Ratio: {{ issue.contrastRatio | number:'1.2-2' }}:1
                  </div>
                  <div class="required-ratio">
                    Required: {{ issue.requiredRatio }}:1
                  </div>
                  <div class="severity" [class]="issue.severity">
                    {{ issue.severity | uppercase }}
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <div class="valid-section">
        <h3 class="section-title success">Valid Combinations</h3>
        <div class="valid-list">
          @for (valid of report().validCombinations; track valid.name) {
            <div class="valid-item">
              <div class="color-swatch-pair">
                <div class="color-swatch" [style.background-color]="valid.backgroundColor">
                  <span class="swatch-text" [style.color]="valid.textColor">Aa</span>
                </div>
                <div class="swatch-info">
                  <div class="swatch-label">{{ valid.type | titlecase }}: {{ valid.name }}</div>
                  <div class="swatch-colors">
                    <span>BG: {{ valid.backgroundColor }}</span>
                    <span>Text: {{ valid.textColor }}</span>
                  </div>
                </div>
              </div>
              <div class="contrast-info">
                <div class="contrast-ratio success">
                  Ratio: {{ valid.contrastRatio | number:'1.2-2' }}:1
                </div>
                <div class="compliance-badge success">
                  WCAG AA ✓
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="wcag-info">
        <h3 class="section-title">WCAG AA Requirements</h3>
        <ul class="requirements-list">
          <li>Normal text: <strong>4.5:1</strong> minimum contrast ratio</li>
          <li>Large text (18pt+ or 14pt+ bold): <strong>3:1</strong> minimum contrast ratio</li>
          <li>UI components and graphics: <strong>3:1</strong> minimum contrast ratio</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .contrast-report {
      padding: 24px;
      background: #ffffff;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      gap: 24px;
    }

    .report-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #111827;
    }

    .report-summary {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 16px;
      border-radius: 6px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      min-width: 80px;
    }

    .summary-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .summary-value {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .refresh-btn {
      padding: 8px 16px;
      background: #f97316;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .refresh-btn:hover {
      background: #ea580c;
    }

    .section-title {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
    }

    .issues-section {
      margin-bottom: 32px;
    }

    .issues-list, .valid-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .issue-item, .valid-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
    }

    .issue-item {
      border-left: 4px solid #ef4444;
    }

    .valid-item {
      border-left: 4px solid #10b981;
    }

    .color-swatch-pair {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .color-swatch {
      width: 60px;
      height: 40px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #d1d5db;
    }

    .swatch-text {
      font-size: 16px;
      font-weight: 600;
    }

    .swatch-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .swatch-label {
      font-weight: 600;
      color: #111827;
    }

    .swatch-colors {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #6b7280;
      font-family: monospace;
    }

    .contrast-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .contrast-ratio {
      font-size: 16px;
      font-weight: 600;
    }

    .required-ratio {
      font-size: 12px;
      color: #6b7280;
    }

    .compliance-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .severity {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }

    .success {
      color: #059669;
      background: #d1fae5;
    }

    .error {
      color: #dc2626;
      background: #fee2e2;
    }

    .severity.warning {
      color: #d97706;
      background: #fef3c7;
    }

    .wcag-info {
      margin-top: 32px;
      padding: 16px;
      background: #f0f9ff;
      border-radius: 8px;
      border: 1px solid #0ea5e9;
    }

    .requirements-list {
      margin: 8px 0 0 0;
      padding-left: 20px;
    }

    .requirements-list li {
      margin-bottom: 4px;
      color: #374151;
    }

    @media (max-width: 768px) {
      .report-header {
        flex-direction: column;
        align-items: stretch;
      }

      .report-summary {
        justify-content: center;
      }

      .issue-item, .valid-item {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .contrast-info {
        align-items: flex-start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorContrastReportComponent {
  // Services
  private colorContrastService = inject(ColorContrastService);

  // State
  private reportData = signal<ColorValidationReport | null>(null);

  // Computed
  report = computed(() => {
    return this.reportData() || this.generateReport();
  });

  constructor() {
    // Generate initial report
    this.refreshReport();
  }

  /**
   * Refresh the contrast report
   */
  refreshReport(): void {
    const newReport = this.generateReport();
    this.reportData.set(newReport);
  }

  /**
   * Generate a new validation report
   */
  private generateReport(): ColorValidationReport {
    return this.colorContrastService.validateApplicationColors();
  }
}