import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface Withdrawal {
  id: number;
  workshop_id: number;
  amount: number;
  status: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  notes?: string;
  admin_notes?: string;
  processed_by?: number;
  failure_reason?: string;
  requested_at?: string;
  processed_at?: string;
  completed_at?: string;
}

export interface WalletInfo {
  workshop_id: number;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  updated_at?: string;
}

export interface FinancialMovement {
  id: number;
  movement_type: string;
  amount: number;
  balance_after: number;
  description?: string;
  transaction_id?: number;
  withdrawal_id?: number;
  created_at?: string;
}

export interface Settlement {
  id: number;
  workshop_id: number;
  period_start?: string;
  period_end?: string;
  total_collected: number;
  total_commission: number;
  total_net: number;
  total_withdrawn: number;
  balance_at_close: number;
  transactions_count: number;
  status: string;
  generated_by?: number;
  notes?: string;
  generated_at?: string;
}

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl;

  // ============================================================================
  // Admin endpoints
  // ============================================================================

  /** Get all withdrawal requests (admin) */
  getAllWithdrawals(page = 1, size = 20, status?: string): Observable<{withdrawals: Withdrawal[], total: number}> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);

    return this.http.get<any>(`${this.baseUrl}/api/v1/admin/withdrawals`, { params }).pipe(
      map(res => res.data)
    );
  }

  /** Approve a withdrawal */
  approveWithdrawal(withdrawalId: number, adminNotes?: string): Observable<Withdrawal> {
    return this.http.patch<any>(
      `${this.baseUrl}/api/v1/admin/withdrawals/${withdrawalId}/approve`,
      { admin_notes: adminNotes }
    ).pipe(map(res => res.data));
  }

  /** Reject a withdrawal */
  rejectWithdrawal(withdrawalId: number, adminNotes?: string): Observable<Withdrawal> {
    return this.http.patch<any>(
      `${this.baseUrl}/api/v1/admin/withdrawals/${withdrawalId}/reject`,
      { admin_notes: adminNotes }
    ).pipe(map(res => res.data));
  }

  /** Mark withdrawal as paid */
  markWithdrawalPaid(withdrawalId: number, adminNotes?: string): Observable<Withdrawal> {
    return this.http.patch<any>(
      `${this.baseUrl}/api/v1/admin/withdrawals/${withdrawalId}/mark-paid`,
      { admin_notes: adminNotes }
    ).pipe(map(res => res.data));
  }

  /** Get settlements for a workshop */
  getWorkshopSettlements(workshopId: number, page = 1, size = 20): Observable<{settlements: Settlement[], total: number}> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(
      `${this.baseUrl}/api/v1/admin/workshops/${workshopId}/settlements`,
      { params }
    ).pipe(map(res => res.data));
  }

  /** Generate a settlement for a workshop */
  generateSettlement(workshopId: number, periodStart: string, periodEnd: string, notes?: string): Observable<Settlement> {
    return this.http.post<any>(
      `${this.baseUrl}/api/v1/admin/workshops/${workshopId}/settlements/generate`,
      {
        period_start: periodStart,
        period_end: periodEnd,
        notes
      }
    ).pipe(map(res => res.data));
  }

  // ============================================================================
  // Workshop endpoints
  // ============================================================================

  /** Get workshop wallet */
  getMyWallet(): Observable<WalletInfo> {
    return this.http.get<any>(`${this.baseUrl}/api/v1/workshops/me/wallet`).pipe(
      map(res => res.data)
    );
  }

  /** Get workshop financial history */
  getMyFinancialHistory(page = 1, size = 20, movementType?: string): Observable<{movements: FinancialMovement[], total: number}> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (movementType) params = params.set('movement_type', movementType);

    return this.http.get<any>(`${this.baseUrl}/api/v1/workshops/me/financial-history`, { params }).pipe(
      map(res => res.data)
    );
  }

  /** Request a withdrawal */
  requestWithdrawal(amount: number, bankName?: string, accountNumber?: string, accountHolder?: string, notes?: string): Observable<Withdrawal> {
    return this.http.post<any>(`${this.baseUrl}/api/v1/workshops/me/withdrawals`, {
      amount,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      notes
    }).pipe(map(res => res.data));
  }

  /** Get workshop withdrawals */
  getMyWithdrawals(page = 1, size = 20, status?: string): Observable<{withdrawals: Withdrawal[], total: number}> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);

    return this.http.get<any>(`${this.baseUrl}/api/v1/workshops/me/withdrawals`, { params }).pipe(
      map(res => res.data)
    );
  }
}
