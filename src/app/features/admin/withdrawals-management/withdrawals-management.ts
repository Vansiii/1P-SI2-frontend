import { Component, ChangeDetectionStrategy, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaymentService, Withdrawal } from '../../../core/services/payment.service';

@Component({
  selector: 'app-withdrawals-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="withdrawals-management">
      <header class="reports-header">
        <div class="header-content">
          <h1>Gestión de Retiros</h1>
          <p class="section-subtitle">Administra y procesa las solicitudes de liquidación de los talleres asociados.</p>
        </div>
        
        <div class="date-filters">
          <div class="field">
            <label for="statusFilter">Estado</label>
            <select id="statusFilter" [ngModel]="statusFilter()" (ngModelChange)="onStatusFilterChange($event)">
              <option value="">Todos los registros</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
              <option value="paid">Pagados</option>
            </select>
          </div>
          <button class="btn-refresh" (click)="loadWithdrawals()" aria-label="Actualizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          </button>
        </div>
      </header>

      <!-- Stats Grid -->
      <div class="kpi-grid">
        <div class="kpi-card pending">
          <span class="kpi-label">Pendientes</span>
          <span class="kpi-value">{{ pendingCount() }}</span>
          <div class="kpi-trend">Por aprobar</div>
        </div>
        <div class="kpi-card approved">
          <span class="kpi-label">Aprobados</span>
          <span class="kpi-value">{{ approvedCount() }}</span>
          <div class="kpi-trend">Pendientes de pago</div>
        </div>
        <div class="kpi-card paid">
          <span class="kpi-label">Pagados</span>
          <span class="kpi-value">{{ paidCount() }}</span>
          <div class="kpi-trend">Liquidaciones completadas</div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="reports-main">
        <section class="report-section full-width">
          <div class="section-header">
            <h2>Solicitudes de Liquidación</h2>
          </div>

          @if (isLoading()) {
            <div class="loading-container">
              <div class="spinner"></div>
              <p>Sincronizando con el servidor...</p>
            </div>
          } @else if (withdrawals().length > 0) {
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Taller</th>
                    <th>Monto</th>
                    <th>Banco / Referencia</th>
                    <th>Estado</th>
                    <th>Fecha Solicitud</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (w of withdrawals(); track w.id) {
                    <tr [class]="'row-' + w.status">
                      <td class="font-bold">#{{ w.id }}</td>
                      <td>
                        <div class="workshop-info">
                          <span class="workshop-id">Taller ID: {{ w.workshop_id }}</span>
                        </div>
                      </td>
                      <td class="amount">Bs. {{ w.amount | number:'1.2-2' }}</td>
                      <td>
                        <div class="bank-details">
                          <span class="bank-name">{{ w.bank_name || 'No especificado' }}</span>
                          @if (w.admin_notes) {
                            <small class="admin-notes">{{ w.admin_notes }}</small>
                          }
                        </div>
                      </td>
                      <td>
                        <span [class]="'badge badge-' + w.status">
                          {{ getStatusLabel(w.status) }}
                        </span>
                      </td>
                      <td>{{ formatDate(w.requested_at) }}</td>
                      <td class="actions">
                        <div class="action-buttons">
                          @if (w.status === 'pending') {
                            <button class="btn-action approve" (click)="approve(w)" title="Aprobar Solicitud">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Aprobar
                            </button>
                            <button class="btn-action reject" (click)="reject(w)" title="Rechazar Solicitud">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              Rechazar
                            </button>
                          }
                          @if (w.status === 'approved') {
                            <button class="btn-action pay" (click)="markPaid(w)" title="Confirmar Pago">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                              Pagar
                            </button>
                          }
                          @if (w.status === 'paid' || w.status === 'rejected') {
                            <span class="status-locked">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                              Cerrado
                            </span>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="empty-state">
              <div class="empty-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <h3>Sin solicitudes</h3>
              <p>No se encontraron retiros con el filtro seleccionado.</p>
            </div>
          }
        </section>
      </div>

      <!-- Admin notes modal -->
      @if (showNotesModal()) {
        <div class="modal-overlay" (click)="closeModal()" (keydown.escape)="closeModal()" tabindex="0" role="button">
          <div class="modal-content" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" tabindex="-1" role="dialog">
            <div class="modal-header">
              <h3>{{ modalTitle() }}</h3>
              <button class="btn-close" (click)="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
              <label for="adminNotes">Observaciones del Administrador</label>
              <textarea
                id="adminNotes"
                [(ngModel)]="adminNotes"
                placeholder="Escribe aquí cualquier detalle relevante sobre esta operación..."
                rows="4"
              ></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button class="btn-primary" (click)="confirmAction()">Confirmar Operación</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .withdrawals-management { padding: 2rem; max-width: 1200px; margin: 0 auto; }
    
    .reports-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; gap: 2rem; }
    .header-content h1 { font-size: 2.25rem; font-weight: 700; margin: 0; letter-spacing: -0.025em; }
    .section-subtitle { color: var(--text-muted); margin-top: 0.5rem; }

    .date-filters { display: flex; gap: 1rem; align-items: flex-end; background: var(--surface); padding: 1rem; border-radius: 16px; border: 1px solid var(--border-light); }
    .date-filters .field { display: flex; flex-direction: column; gap: 4px; }
    .date-filters label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
    .date-filters select { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-light); background: #f8fafc; font-weight: 500; min-width: 180px; }
    
    .btn-refresh { background: var(--primary); color: white; border: none; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-refresh svg { width: 20px; height: 20px; transition: transform 0.3s ease; }
    .btn-refresh:hover svg { transform: rotate(180deg); }

    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 3rem; }
    .kpi-card { background: var(--surface); padding: 1.5rem; border-radius: 20px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); position: relative; overflow: hidden; }
    .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; }
    .kpi-card.pending::before { background: #f59e0b; }
    .kpi-card.approved::before { background: #3b82f6; }
    .kpi-card.paid::before { background: #10b981; }
    
    .kpi-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
    .kpi-value { display: block; font-size: 2rem; font-weight: 700; color: var(--text-main); font-family: var(--font-display); }
    .kpi-trend { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; }

    .reports-main { display: grid; grid-template-columns: 1fr; gap: 2rem; }
    .report-section { background: var(--surface); padding: 2rem; border-radius: 24px; border: 1px solid var(--border-light); box-shadow: var(--shadow-md); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .section-header h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }

    .full-width { grid-column: 1 / -1; }

    .table-container { overflow-x: auto; margin: 0 -2rem; padding: 0 2rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 1.25rem 1rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-light); }
    td { padding: 1.25rem 1rem; font-size: 0.85rem; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
    
    .font-bold { font-weight: 700; color: var(--text-main); }
    .amount { font-family: var(--font-display); font-weight: 700; color: var(--primary); font-size: 1rem; }
    
    .workshop-info { display: flex; flex-direction: column; }
    .workshop-id { font-weight: 600; color: var(--text-main); }
    
    .bank-details { display: flex; flex-direction: column; gap: 4px; }
    .bank-name { font-weight: 500; }
    .admin-notes { font-size: 0.75rem; color: var(--text-muted); font-style: italic; max-width: 200px; }

    .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dbeafe; color: #1e40af; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-paid { background: #dcfce7; color: #166534; }

    .action-buttons { display: flex; gap: 8px; align-items: center; }
    .text-right { text-align: right; }

    .btn-action { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-size: 0.75rem; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s ease; }
    .btn-action svg { width: 14px; height: 14px; }
    
    .btn-action.approve { background: #10b981; color: white; }
    .btn-action.reject { background: white; color: #ef4444; border: 1.5px solid #fee2e2; }
    .btn-action.pay { background: var(--primary); color: white; }
    .btn-action:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

    .status-locked { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 0.75rem; font-weight: 600; background: #f8fafc; padding: 6px 12px; border-radius: 8px; }
    .status-locked svg { width: 12px; height: 12px; }

    .loading-container { display: flex; flex-direction: column; align-items: center; padding: 4rem; color: var(--text-muted); }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 5rem 2rem; text-align: center; color: var(--text-muted); }
    .empty-icon-wrapper { width: 80px; height: 80px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #cbd5e1; }
    .empty-icon-wrapper svg { width: 40px; height: 40px; }
    .empty-state h3 { margin: 0 0 0.5rem; color: var(--text-main); font-size: 1.25rem; }

    /* Modal Styling */
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.3s ease; }
    .modal-content { background: white; border-radius: 24px; width: 450px; max-width: 90vw; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: slideUp 0.3s ease; }
    .modal-header { padding: 1.5rem 2rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; }
    .modal-body { padding: 2rem; }
    .modal-body label { display: block; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 0.75rem; }
    .modal-body textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; font-family: inherit; font-size: 0.9rem; transition: border-color 0.2s; }
    .modal-body textarea:focus { outline: none; border-color: var(--primary); ring: 2px solid var(--primary-light); }
    .modal-footer { padding: 1.5rem 2rem; background: #f8fafc; display: flex; gap: 1rem; justify-content: flex-end; }
    
    .btn-primary, .btn-secondary { padding: 10px 20px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: var(--primary); color: white; border: none; }
    .btn-secondary { background: white; color: #64748b; border: 1px solid #e2e8f0; }
    .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `
})
export class WithdrawalsManagementComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private destroyRef = inject(DestroyRef);

  withdrawals = signal<Withdrawal[]>([]);
  isLoading = signal(false);
  statusFilter = signal('');
  showNotesModal = signal(false);
  modalTitle = signal('');
  adminNotes = '';

  private pendingAction: { type: string; withdrawal: Withdrawal } | null = null;

  pendingCount = signal(0);
  approvedCount = signal(0);
  paidCount = signal(0);

  ngOnInit() {
    this.loadWithdrawals();
  }

  loadWithdrawals() {
    this.isLoading.set(true);
    const status = this.statusFilter() || undefined;

    this.paymentService.getAllWithdrawals(1, 100, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (data) => {
        this.withdrawals.set(data.withdrawals);
        this.updateCounts(data.withdrawals);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onStatusFilterChange(value: string) {
    this.statusFilter.set(value);
    this.loadWithdrawals();
  }

  private updateCounts(list: Withdrawal[]) {
    this.pendingCount.set(list.filter(w => w.status === 'pending').length);
    this.approvedCount.set(list.filter(w => w.status === 'approved').length);
    this.paidCount.set(list.filter(w => w.status === 'paid').length);
  }

  approve(w: Withdrawal) {
    this.pendingAction = { type: 'approve', withdrawal: w };
    this.modalTitle.set(`Aprobar retiro #${w.id} — Bs. ${w.amount.toFixed(2)}`);
    this.adminNotes = '';
    this.showNotesModal.set(true);
  }

  reject(w: Withdrawal) {
    this.pendingAction = { type: 'reject', withdrawal: w };
    this.modalTitle.set(`Rechazar retiro #${w.id} — Bs. ${w.amount.toFixed(2)}`);
    this.adminNotes = '';
    this.showNotesModal.set(true);
  }

  markPaid(w: Withdrawal) {
    this.pendingAction = { type: 'mark-paid', withdrawal: w };
    this.modalTitle.set(`Marcar como pagado retiro #${w.id} — Bs. ${w.amount.toFixed(2)}`);
    this.adminNotes = '';
    this.showNotesModal.set(true);
  }

  confirmAction() {
    if (!this.pendingAction) return;
    const { type, withdrawal } = this.pendingAction;
    const notes = this.adminNotes || undefined;

    let obs;
    switch (type) {
      case 'approve':
        obs = this.paymentService.approveWithdrawal(withdrawal.id, notes);
        break;
      case 'reject':
        obs = this.paymentService.rejectWithdrawal(withdrawal.id, notes);
        break;
      case 'mark-paid':
        obs = this.paymentService.markWithdrawalPaid(withdrawal.id, notes);
        break;
      default:
        return;
    }

    obs.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.closeModal();
        this.loadWithdrawals();
      },
      error: (err: { error?: { detail?: string } }) => {
        alert(err?.error?.detail || 'Error al procesar la solicitud');
      }
    });
  }

  closeModal() {
    this.showNotesModal.set(false);
    this.pendingAction = null;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      paid: 'Pagado',
    };
    return labels[status] || status;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
