import { Component, ChangeDetectionStrategy, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaymentService, WalletInfo, FinancialMovement, Withdrawal } from '../../../core/services/payment.service';

@Component({
  selector: 'app-workshop-wallet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wallet-container">
      <header class="wallet-header">
        <div class="header-content">
          <h1>Mi Billetera</h1>
          <p class="subtitle">Gestiona tus ingresos y solicitudes de retiro de forma segura.</p>
        </div>
      </header>

      <!-- Main Balance Grid -->
      @if (wallet(); as w) {
        <div class="balance-grid">
          <div class="balance-card primary">
            <div class="card-glow"></div>
            <div class="card-header">
              <span class="label">Saldo Disponible</span>
              <div class="icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
            </div>
            <div class="amount-display">
              <span class="currency">Bs.</span>
              <span class="value">{{ w.available_balance | number:'1.2-2' }}</span>
            </div>
            <button class="action-btn" (click)="showWithdrawalForm.set(true)" [disabled]="w.available_balance <= 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              Solicitar Retiro
            </button>
          </div>

          <div class="stats-cards">
            <div class="stat-item">
              <div class="stat-icon pending">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-label">En retiro</span>
                <span class="stat-value">Bs. {{ w.pending_balance | number:'1.2-2' }}</span>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-icon earned">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-label">Total ganado</span>
                <span class="stat-value">Bs. {{ w.total_earned | number:'1.2-2' }}</span>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-icon withdrawn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M3 7h18"/><path d="M5 21V7"/><path d="M19 21V7"/><path d="M9 7v14"/><path d="M15 7v14"/><path d="M2 7l10-4 10 4"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-label">Total retirado</span>
                <span class="stat-value">Bs. {{ w.total_withdrawn | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Tabs Navigation -->
      <nav class="wallet-tabs" role="tablist">
        <button role="tab" [attr.aria-selected]="activeTab() === 'history'" [class.active]="activeTab() === 'history'" (click)="activeTab.set('history'); loadHistory()">
          Historial de Movimientos
        </button>
        <button role="tab" [attr.aria-selected]="activeTab() === 'withdrawals'" [class.active]="activeTab() === 'withdrawals'" (click)="activeTab.set('withdrawals'); loadWithdrawals()">
          Mis Solicitudes
        </button>
      </nav>

      <!-- Content Area -->
      <main class="tab-content">
        @if (isLoading()) {
          <div class="loader-overlay">
            <div class="elegant-spinner"></div>
            <p>Sincronizando datos...</p>
          </div>
        } @else {
          <!-- History Tab -->
          @if (activeTab() === 'history') {
            @if (movements().length > 0) {
              <div class="list-wrapper">
                @for (m of movements(); track m.id) {
                  <div class="movement-row" [class.income]="m.amount > 0">
                    <div class="movement-main">
                      <div class="type-indicator"></div>
                      <div class="details">
                        <span class="title">{{ getMovementLabel(m.movement_type) }}</span>
                        <span class="desc">{{ m.description }}</span>
                      </div>
                    </div>
                    <div class="movement-meta">
                      <span class="date">{{ formatDate(m.created_at) }}</span>
                      <span class="amount" [class.positive]="m.amount > 0">
                        {{ m.amount > 0 ? '+' : '' }}Bs. {{ m.amount | number:'1.2-2' }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">
                <div class="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <h3>Sin actividad reciente</h3>
                <p>Tus transacciones aparecerán aquí una vez que completes servicios.</p>
              </div>
            }
          }

          <!-- Withdrawals Tab -->
          @if (activeTab() === 'withdrawals') {
            @if (withdrawals().length > 0) {
              <div class="list-wrapper">
                @for (w of withdrawals(); track w.id) {
                  <div class="withdrawal-row">
                    <div class="withdrawal-info">
                      <span class="amount">Bs. {{ w.amount | number:'1.2-2' }}</span>
                      <span class="bank-details">{{ w.bank_name }} · {{ w.account_number }}</span>
                      <span class="date">{{ formatDate(w.requested_at) }}</span>
                    </div>
                    <div class="withdrawal-status">
                      <span class="status-pill" [class]="'pill-' + w.status">
                        {{ getStatusLabel(w.status) }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">
                <div class="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h3>Sin retiros</h3>
                <p>Aún no has solicitado transferencias a tu cuenta bancaria.</p>
              </div>
            }
          }
        }
      </main>

      <!-- Withdrawal Modal -->
      @if (showWithdrawalForm()) {
        <div class="modal-backdrop" role="button" tabindex="0" (click)="showWithdrawalForm.set(false)" (keydown.escape)="showWithdrawalForm.set(false)">
          <div class="modal-card" role="dialog" aria-labelledby="modal-title" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" tabindex="-1">
            <div class="modal-header">
              <h3 id="modal-title">Solicitar Retiro</h3>
              <p>El proceso de transferencia puede demorar de 24 a 48 horas hábiles.</p>
            </div>
            
            <div class="available-badge">
              <span>Disponible: Bs. {{ wallet()?.available_balance | number:'1.2-2' }}</span>
            </div>

            <form class="modal-form" (submit)="$event.preventDefault(); submitWithdrawal()">
              <div class="form-grid">
                <div class="form-field">
                  <label for="withdrawal-amount">Monto a retirar</label>
                  <div class="input-prefix">
                    <span>Bs.</span>
                    <input id="withdrawal-amount" type="number" [(ngModel)]="withdrawalAmount" name="amount" min="100" [max]="wallet()?.available_balance || 0" step="0.01" required />
                  </div>
                </div>

                <div class="form-field">
                  <label for="bank-name">Banco</label>
                  <input id="bank-name" type="text" [(ngModel)]="bankName" name="bank" placeholder="Ej. Banco Unión" required />
                </div>

                <div class="form-field">
                  <label for="account-number">Número de Cuenta</label>
                  <input id="account-number" type="text" [(ngModel)]="accountNumber" name="account" placeholder="Nº de cuenta o CUIT" required />
                </div>

                <div class="form-field">
                  <label for="account-holder">Titular de la Cuenta</label>
                  <input id="account-holder" type="text" [(ngModel)]="accountHolder" name="holder" placeholder="Nombre completo" required />
                </div>

                <div class="form-field full">
                  <label for="withdrawal-notes">Notas adicionales</label>
                  <textarea id="withdrawal-notes" [(ngModel)]="withdrawalNotes" name="notes" rows="2" placeholder="Opcional..."></textarea>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-ghost" (click)="showWithdrawalForm.set(false)">Cancelar</button>
                <button type="submit" class="btn-submit" [disabled]="isSubmitting() || withdrawalAmount < 100">
                  {{ isSubmitting() ? 'Procesando...' : 'Confirmar Solicitud' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .wallet-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem;
      animation: fadeIn 0.4s ease-out;
    }

    .wallet-header { margin-bottom: 2.5rem; }
    .wallet-header h1 { font-size: 2.25rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.025em; }
    .subtitle { color: var(--text-muted); margin-top: 0.5rem; font-size: 1.1rem; }

    /* Balance Grid Layout */
    .balance-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    /* Main Featured Card */
    .balance-card.primary {
      position: relative;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 24px;
      padding: 2.5rem;
      color: white;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    .card-glow {
      position: absolute;
      top: -50%;
      right: -20%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%);
      filter: blur(40px);
    }

    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .card-header .label { font-size: 1rem; opacity: 0.8; font-weight: 500; }
    .icon-box { background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 12px; }
    .icon-box svg { width: 24px; height: 24px; color: var(--primary); }

    .amount-display { margin: 1.5rem 0 2.5rem; }
    .amount-display .currency { font-size: 1.5rem; font-weight: 500; color: var(--primary); margin-right: 8px; }
    .amount-display .value { font-size: 3.5rem; font-weight: 700; font-family: var(--font-display); }

    .action-btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 1rem 1.5rem;
      border-radius: 14px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      width: 100%;
    }

    .action-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.4); }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-btn svg { width: 18px; height: 18px; }

    /* Sidebar Stats */
    .stats-cards { display: flex; flex-direction: column; gap: 1rem; }
    .stat-item {
      background: var(--surface);
      border: 1px solid var(--border-light);
      padding: 1.25rem;
      border-radius: 18px;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      transition: all 0.2s;
    }
    .stat-item:hover { border-color: var(--primary-subtle); transform: translateX(4px); }

    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .stat-icon svg { width: 24px; height: 24px; }
    
    .stat-icon.pending { background: #fff7ed; color: #ea580c; }
    .stat-icon.earned { background: #f0fdf4; color: #16a34a; }
    .stat-icon.withdrawn { background: #eff6ff; color: #2563eb; }

    .stat-label { display: block; font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
    .stat-value { display: block; font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-top: 2px; }

    /* Tabs Navigation */
    .wallet-tabs { display: flex; gap: 1rem; border-bottom: 2px solid var(--border-light); margin-bottom: 1.5rem; }
    .wallet-tabs button {
      padding: 1rem 0.5rem;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -2px;
    }
    .wallet-tabs button.active { color: var(--primary); border-bottom-color: var(--primary); }
    .wallet-tabs button:hover:not(.active) { color: var(--text-main); }

    /* Lists and Rows */
    .list-wrapper { display: flex; flex-direction: column; gap: 0.75rem; }
    
    .movement-row {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 14px;
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .movement-main { display: flex; align-items: center; gap: 1rem; }
    .type-indicator { width: 4px; height: 40px; border-radius: 2px; background: #94a3b8; }
    .income .type-indicator { background: var(--success); }
    
    .details { display: flex; flex-direction: column; }
    .details .title { font-weight: 600; color: var(--text-main); }
    .details .desc { font-size: 0.85rem; color: var(--text-muted); }

    .movement-meta { text-align: right; }
    .movement-meta .date { display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; }
    .movement-meta .amount { font-weight: 700; font-size: 1.1rem; }
    .amount.positive { color: var(--success); }

    .withdrawal-row {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 14px;
      padding: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .withdrawal-info .amount { display: block; font-size: 1.25rem; font-weight: 700; }
    .withdrawal-info .bank-details { display: block; font-size: 0.85rem; color: var(--text-muted); margin: 4px 0; }
    .withdrawal-info .date { font-size: 0.75rem; color: #94a3b8; }

    .status-pill {
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    .pill-pending { background: #fef3c7; color: #92400e; }
    .pill-approved { background: #dcfce7; color: #166534; }
    .pill-paid { background: #dbeafe; color: #1e40af; }
    .pill-rejected { background: #fee2e2; color: #991b1b; }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card {
      background: var(--surface);
      width: 100%;
      max-width: 520px;
      border-radius: 24px;
      padding: 2.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-header h3 { font-size: 1.5rem; margin: 0; }
    .modal-header p { color: var(--text-muted); font-size: 0.9rem; margin: 8px 0 24px; }

    .available-badge { background: var(--primary-subtle); color: var(--primary-hover); padding: 12px; border-radius: 12px; text-align: center; font-weight: 700; margin-bottom: 2rem; }

    .form-grid { display: grid; gap: 1.25rem; }
    .form-field label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: var(--text-main); }
    .input-prefix { display: flex; align-items: center; background: #f8fafc; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
    .input-prefix span { padding: 0 1rem; font-weight: 700; color: var(--text-muted); }
    .input-prefix input { border: none; background: none; padding: 12px 0; width: 100%; }
    
    input[type="text"], textarea {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border-light);
      border-radius: 10px;
      background: #f8fafc;
    }
    .form-field.full { grid-column: 1 / -1; }

    .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2.5rem; }
    .btn-ghost { background: none; border: none; font-weight: 600; cursor: pointer; color: var(--text-muted); }
    .btn-submit { background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-submit:hover:not(:disabled) { transform: scale(1.02); }

    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
    .empty-icon svg { width: 64px; height: 64px; margin-bottom: 1.5rem; stroke: var(--border-light); }
    
    .elegant-spinner { width: 40px; height: 40px; border: 3px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes modalSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    @media (max-width: 768px) {
      .balance-grid { grid-template-columns: 1fr; }
      .wallet-container { padding: 1rem; }
      .amount-display .value { font-size: 2.5rem; }
    }
  `
})
export class WorkshopWalletComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly destroyRef = inject(DestroyRef);

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
    this.paymentService.getMyWallet()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.wallet.set(data),
        error: (err) => console.error('Error loading wallet:', err)
      });
  }

  loadHistory() {
    this.isLoading.set(true);
    this.paymentService.getMyFinancialHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.movements.set(data.movements);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading history:', err);
          this.isLoading.set(false);
        }
      });
  }

  loadWithdrawals() {
    this.isLoading.set(true);
    this.paymentService.getMyWithdrawals()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.withdrawals.set(data.withdrawals);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading withdrawals:', err);
          this.isLoading.set(false);
        }
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
    )
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
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
      error: (err: { error?: { detail?: string } }) => {
        this.isSubmitting.set(false);
        alert(err?.error?.detail || 'Error al solicitar retiro');
      }
    });
  }

  getMovementLabel(type: string): string {
    const labels: Record<string, string> = {
      payment_received: 'Ingreso por Servicio',
      withdrawal_requested: 'Retiro en Revisión',
      withdrawal_completed: 'Retiro Ejecutado',
      withdrawal_reversed: 'Retiro Revertido',
      refund: 'Reembolso Emitido',
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
      return d.toLocaleDateString('es-BO', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }
}
