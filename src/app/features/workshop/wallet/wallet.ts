import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, WalletInfo, FinancialMovement, Withdrawal } from '../../../core/services/payment.service';

@Component({
  selector: 'app-workshop-wallet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wallet-page">
      <header class="page-header">
        <h1>Mi Billetera</h1>
        <p class="subtitle">Gestión financiera de tu taller</p>
      </header>

      <!-- Wallet cards -->
      @if (wallet()) {
        <div class="wallet-grid">
          <div class="wallet-card available">
            <div class="card-icon">💰</div>
            <div class="card-label">Disponible</div>
            <div class="card-amount">Bs. {{ wallet()!.available_balance.toFixed(2) }}</div>
          </div>
          <div class="wallet-card pending">
            <div class="card-icon">⏳</div>
            <div class="card-label">En retiro</div>
            <div class="card-amount">Bs. {{ wallet()!.pending_balance.toFixed(2) }}</div>
          </div>
          <div class="wallet-card earned">
            <div class="card-icon">📈</div>
            <div class="card-label">Total ganado</div>
            <div class="card-amount">Bs. {{ wallet()!.total_earned.toFixed(2) }}</div>
          </div>
          <div class="wallet-card withdrawn">
            <div class="card-icon">🏦</div>
            <div class="card-label">Total retirado</div>
            <div class="card-amount">Bs. {{ wallet()!.total_withdrawn.toFixed(2) }}</div>
          </div>
        </div>

        <!-- Withdrawal button -->
        <div class="withdrawal-section">
          <button class="btn-withdrawal" (click)="showWithdrawalForm.set(true)" [disabled]="wallet()!.available_balance <= 0">
            💸 Solicitar Retiro
          </button>
        </div>
      }

      <!-- Withdrawal form -->
      @if (showWithdrawalForm()) {
        <div class="modal-overlay" (click)="showWithdrawalForm.set(false)">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <h3>Solicitar Retiro</h3>
            <p class="available-info">Disponible: Bs. {{ wallet()?.available_balance?.toFixed(2) || '0.00' }}</p>

            <div class="form-group">
              <label for="amount">Monto a retirar</label>
              <input id="amount" type="number" [(ngModel)]="withdrawalAmount" min="100" [max]="wallet()?.available_balance || 0" step="0.01" />
            </div>
            <div class="form-group">
              <label for="bank">Banco</label>
              <input id="bank" type="text" [(ngModel)]="bankName" placeholder="Nombre del banco" />
            </div>
            <div class="form-group">
              <label for="account">Número de cuenta</label>
              <input id="account" type="text" [(ngModel)]="accountNumber" placeholder="Número de cuenta" />
            </div>
            <div class="form-group">
              <label for="holder">Titular</label>
              <input id="holder" type="text" [(ngModel)]="accountHolder" placeholder="Nombre del titular" />
            </div>
            <div class="form-group">
              <label for="notes">Notas (opcional)</label>
              <textarea id="notes" [(ngModel)]="withdrawalNotes" rows="2"></textarea>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="showWithdrawalForm.set(false)">Cancelar</button>
              <button class="btn-confirm" (click)="submitWithdrawal()" [disabled]="isSubmitting()">
                {{ isSubmitting() ? 'Enviando...' : 'Solicitar' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="tabs">
        <button [class.active]="activeTab() === 'history'" (click)="activeTab.set('history'); loadHistory()">
          Historial Financiero
        </button>
        <button [class.active]="activeTab() === 'withdrawals'" (click)="activeTab.set('withdrawals'); loadWithdrawals()">
          Mis Retiros
        </button>
      </div>

      <!-- Financial history tab -->
      @if (activeTab() === 'history') {
        @if (isLoading()) {
          <div class="loading"><div class="spinner"></div></div>
        } @else if (movements().length > 0) {
          <div class="movements-list">
            @for (m of movements(); track m.id) {
              <div class="movement-item" [class]="m.amount > 0 ? 'income' : 'expense'">
                <div class="movement-info">
                  <div class="movement-type">{{ getMovementLabel(m.movement_type) }}</div>
                  <div class="movement-desc">{{ m.description }}</div>
                  <div class="movement-date">{{ formatDate(m.created_at) }}</div>
                </div>
                <div class="movement-amount" [class.positive]="m.amount > 0" [class.negative]="m.amount < 0">
                  {{ m.amount > 0 ? '+' : '' }}Bs. {{ m.amount.toFixed(2) }}
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <p>No hay movimientos financieros aún</p>
          </div>
        }
      }

      <!-- Withdrawals tab -->
      @if (activeTab() === 'withdrawals') {
        @if (isLoading()) {
          <div class="loading"><div class="spinner"></div></div>
        } @else if (withdrawals().length > 0) {
          <div class="withdrawals-list">
            @for (w of withdrawals(); track w.id) {
              <div class="withdrawal-item">
                <div class="withdrawal-info">
                  <div class="withdrawal-amount-label">Bs. {{ w.amount.toFixed(2) }}</div>
                  <div class="withdrawal-bank">{{ w.bank_name || 'Sin banco' }} · {{ w.account_number || '' }}</div>
                  <div class="withdrawal-date">{{ formatDate(w.requested_at) }}</div>
                </div>
                <span [class]="'badge badge-' + w.status">{{ getStatusLabel(w.status) }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <p>No tienes solicitudes de retiro</p>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .wallet-page {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    .page-header h1 { margin: 0 0 4px; font-size: 1.75rem; color: #1a1a2e; }
    .subtitle { color: #6b7280; margin: 0 0 24px; }

    .wallet-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .wallet-card {
      padding: 20px;
      border-radius: 14px;
      text-align: center;
      border: 1px solid #e5e7eb;
    }

    .wallet-card.available { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-color: #86efac; }
    .wallet-card.pending { background: linear-gradient(135deg, #fffbeb, #fef3c7); border-color: #fcd34d; }
    .wallet-card.earned { background: linear-gradient(135deg, #eff6ff, #dbeafe); border-color: #93c5fd; }
    .wallet-card.withdrawn { background: linear-gradient(135deg, #faf5ff, #ede9fe); border-color: #c4b5fd; }

    .card-icon { font-size: 1.5rem; margin-bottom: 4px; }
    .card-label { font-size: 0.8rem; color: #6b7280; }
    .card-amount { font-size: 1.5rem; font-weight: 700; margin-top: 4px; }

    .withdrawal-section { text-align: center; margin-bottom: 24px; }

    .btn-withdrawal {
      padding: 12px 32px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .btn-withdrawal:hover:not(:disabled) { transform: translateY(-1px); }
    .btn-withdrawal:disabled { opacity: 0.5; cursor: not-allowed; }

    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }

    .tabs button {
      padding: 10px 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }

    .tabs button.active {
      color: #3b82f6;
      border-bottom-color: #3b82f6;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .movements-list, .withdrawals-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .movement-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-radius: 10px;
      background: white;
      border: 1px solid #f3f4f6;
    }

    .movement-type { font-weight: 600; font-size: 0.875rem; }
    .movement-desc { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }
    .movement-date { font-size: 0.75rem; color: #9ca3af; margin-top: 2px; }

    .movement-amount {
      font-weight: 700;
      font-size: 1rem;
      font-family: 'Roboto Mono', monospace;
    }

    .movement-amount.positive { color: #16a34a; }
    .movement-amount.negative { color: #dc2626; }

    .withdrawal-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-radius: 10px;
      background: white;
      border: 1px solid #f3f4f6;
    }

    .withdrawal-amount-label { font-weight: 700; font-size: 1rem; }
    .withdrawal-bank { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }
    .withdrawal-date { font-size: 0.75rem; color: #9ca3af; margin-top: 2px; }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dbeafe; color: #1e40af; }
    .badge-rejected { background: #fecaca; color: #991b1b; }
    .badge-paid { background: #bbf7d0; color: #166534; }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: #9ca3af;
    }

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
      width: 420px;
      max-width: 90vw;
    }

    .modal-content h3 { margin: 0 0 8px; }
    .available-info { color: #16a34a; font-weight: 600; margin: 0 0 16px; }

    .form-group {
      margin-bottom: 12px;
    }

    .form-group label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 4px;
      color: #374151;
    }

    .form-group input, .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-family: inherit;
      font-size: 0.875rem;
      box-sizing: border-box;
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
      font-weight: 600;
    }

    .btn-confirm:hover { background: #2563eb; }
    .btn-confirm:disabled { opacity: 0.5; }
  `
})
export class WorkshopWalletComponent implements OnInit {
  private paymentService = inject(PaymentService);

  wallet = signal<WalletInfo | null>(null);
  movements = signal<FinancialMovement[]>([]);
  withdrawals = signal<Withdrawal[]>([]);
  isLoading = signal(false);
  activeTab = signal<'history' | 'withdrawals'>('history');
  showWithdrawalForm = signal(false);
  isSubmitting = signal(false);

  // Withdrawal form fields
  withdrawalAmount = 0;
  bankName = '';
  accountNumber = '';
  accountHolder = '';
  withdrawalNotes = '';

  ngOnInit() {
    this.loadWallet();
    this.loadHistory();
  }

  loadWallet() {
    this.paymentService.getMyWallet().subscribe({
      next: (data) => this.wallet.set(data),
      error: () => {}
    });
  }

  loadHistory() {
    this.isLoading.set(true);
    this.paymentService.getMyFinancialHistory().subscribe({
      next: (data) => {
        this.movements.set(data.movements);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadWithdrawals() {
    this.isLoading.set(true);
    this.paymentService.getMyWithdrawals().subscribe({
      next: (data) => {
        this.withdrawals.set(data.withdrawals);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  submitWithdrawal() {
    if (this.withdrawalAmount <= 0) return;
    this.isSubmitting.set(true);

    this.paymentService.requestWithdrawal(
      this.withdrawalAmount,
      this.bankName || undefined,
      this.accountNumber || undefined,
      this.accountHolder || undefined,
      this.withdrawalNotes || undefined
    ).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showWithdrawalForm.set(false);
        this.loadWallet();
        this.loadWithdrawals();
        // Reset form
        this.withdrawalAmount = 0;
        this.bankName = '';
        this.accountNumber = '';
        this.accountHolder = '';
        this.withdrawalNotes = '';
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        alert(err?.error?.detail || 'Error al solicitar retiro');
      }
    });
  }

  getMovementLabel(type: string): string {
    const labels: Record<string, string> = {
      payment_received: 'Pago recibido',
      withdrawal_requested: 'Retiro solicitado',
      withdrawal_completed: 'Retiro completado',
      withdrawal_reversed: 'Retiro revertido',
      refund: 'Reembolso',
    };
    return labels[type] || type;
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
