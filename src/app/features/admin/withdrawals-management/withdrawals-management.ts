import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Withdrawal } from '../../../core/services/payment.service';

@Component({
  selector: 'app-withdrawals-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="withdrawals-management">
      <header class="page-header">
        <h1>Gestión de Retiros</h1>
        <p class="subtitle">Administra las solicitudes de retiro de los talleres</p>
      </header>

      <!-- Filters -->
      <div class="filters-row">
        <div class="filter-group">
          <label for="statusFilter">Filtrar por estado:</label>
          <select id="statusFilter" [ngModel]="statusFilter()" (ngModelChange)="onStatusFilterChange($event)">
            <option value="">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
            <option value="paid">Pagados</option>
          </select>
        </div>
        <button class="btn-refresh" (click)="loadWithdrawals()">
          <span class="icon">🔄</span> Actualizar
        </button>
      </div>

      <!-- Stats cards -->
      <div class="stats-row">
        <div class="stat-card pending">
          <div class="stat-number">{{ pendingCount() }}</div>
          <div class="stat-label">Pendientes</div>
        </div>
        <div class="stat-card approved">
          <div class="stat-number">{{ approvedCount() }}</div>
          <div class="stat-label">Aprobados</div>
        </div>
        <div class="stat-card paid">
          <div class="stat-number">{{ paidCount() }}</div>
          <div class="stat-label">Pagados</div>
        </div>
      </div>

      <!-- Loading -->
      @if (isLoading()) {
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Cargando solicitudes...</p>
        </div>
      }

      <!-- Withdrawals list -->
      @if (!isLoading() && withdrawals().length > 0) {
        <div class="withdrawals-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Taller</th>
                <th>Monto</th>
                <th>Banco</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (w of withdrawals(); track w.id) {
                <tr [class]="'row-' + w.status">
                  <td>#{{ w.id }}</td>
                  <td>Taller #{{ w.workshop_id }}</td>
                  <td class="amount">Bs. {{ w.amount.toFixed(2) }}</td>
                  <td>{{ w.bank_name || '—' }}</td>
                  <td>
                    <span [class]="'badge badge-' + w.status">
                      {{ getStatusLabel(w.status) }}
                    </span>
                  </td>
                  <td>{{ formatDate(w.requested_at) }}</td>
                  <td class="actions">
                    @if (w.status === 'pending') {
                      <button class="btn-approve" (click)="approve(w)" title="Aprobar">
                        ✅ Aprobar
                      </button>
                      <button class="btn-reject" (click)="reject(w)" title="Rechazar">
                        ❌ Rechazar
                      </button>
                    }
                    @if (w.status === 'approved') {
                      <button class="btn-paid" (click)="markPaid(w)" title="Marcar como pagado">
                        💸 Pagado
                      </button>
                    }
                    @if (w.status === 'paid' || w.status === 'rejected') {
                      <span class="text-muted">Sin acciones</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!isLoading() && withdrawals().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>No hay solicitudes de retiro</p>
        </div>
      }

      <!-- Admin notes modal -->
      @if (showNotesModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <h3>{{ modalTitle() }}</h3>
            <textarea
              [(ngModel)]="adminNotes"
              placeholder="Notas del administrador (opcional)"
              rows="3"
            ></textarea>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="closeModal()">Cancelar</button>
              <button class="btn-confirm" (click)="confirmAction()">Confirmar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .withdrawals-management {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header h1 {
      margin: 0 0 4px;
      font-size: 1.75rem;
      color: #1a1a2e;
    }

    .subtitle {
      color: #6b7280;
      margin: 0 0 24px;
    }

    .filters-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .btn-refresh {
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.2s;
    }

    .btn-refresh:hover {
      background: #f3f4f6;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }

    .stat-card.pending { background: #fff7ed; border: 1px solid #fed7aa; }
    .stat-card.approved { background: #eff6ff; border: 1px solid #bfdbfe; }
    .stat-card.paid { background: #f0fdf4; border: 1px solid #bbf7d0; }

    .stat-number {
      font-size: 2rem;
      font-weight: 700;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 4px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: #6b7280;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .withdrawals-table {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #f9fafb;
      padding: 12px 16px;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 0.875rem;
    }

    .amount {
      font-weight: 600;
      font-family: 'Roboto Mono', monospace;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dbeafe; color: #1e40af; }
    .badge-rejected { background: #fecaca; color: #991b1b; }
    .badge-paid { background: #bbf7d0; color: #166534; }

    .actions {
      display: flex;
      gap: 8px;
    }

    .btn-approve, .btn-reject, .btn-paid {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .btn-approve { background: #d1fae5; color: #065f46; }
    .btn-reject { background: #fee2e2; color: #991b1b; }
    .btn-paid { background: #dbeafe; color: #1e40af; }

    .btn-approve:hover, .btn-reject:hover, .btn-paid:hover { opacity: 0.8; }

    .text-muted { color: #9ca3af; font-size: 0.8rem; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: #9ca3af;
    }

    .empty-icon { font-size: 3rem; margin-bottom: 12px; }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      padding: 24px;
      width: 400px;
      max-width: 90vw;
    }

    .modal-content h3 { margin: 0 0 16px; }

    .modal-content textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      resize: vertical;
      font-family: inherit;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .btn-cancel {
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: white;
      cursor: pointer;
    }

    .btn-confirm {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      background: #3b82f6;
      color: white;
      cursor: pointer;
    }

    .btn-confirm:hover { background: #2563eb; }
  `
})
export class WithdrawalsManagementComponent implements OnInit {
  private paymentService = inject(PaymentService);

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

    this.paymentService.getAllWithdrawals(1, 100, status).subscribe({
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

    obs.subscribe({
      next: () => {
        this.closeModal();
        this.loadWithdrawals();
      },
      error: (err: any) => {
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
