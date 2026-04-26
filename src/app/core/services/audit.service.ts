import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WebSocketService } from './websocket.service';

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  ip_address: string;
  user_agent?: string;
  details?: string;
  timestamp: string;
  /** Populated from WebSocket event payload field names */
  entity_type?: string | null;
  entity_id?: number | null;
  /** Visual flag set by the service for critical security events */
  isCritical?: boolean;
}

/** Actions considered security-critical and highlighted in the UI */
const CRITICAL_ACTIONS = new Set([
  'login_failed',
  'account_locked',
  'password_reset',
  'token_revoke_all',
  '2fa_disabled',
]);

@Injectable({
  providedIn: 'root',
})
export class AuditService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);

  private readonly auditLogsSubject = new BehaviorSubject<AuditLog[]>([]);
  private wsSubscription?: Subscription;

  /** Observable of all audit log entries (newest first) */
  readonly auditLogs$: Observable<AuditLog[]> = this.auditLogsSubject.asObservable();

  /** Observable of only security-critical audit entries */
  readonly criticalEvents$: Observable<AuditLog[]> = this.auditLogs$.pipe(
    map((logs) => logs.filter((log) => log.isCritical))
  );

  constructor() {
    this.subscribeToWebSocketEvents();
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
  }

  // ---------------------------------------------------------------------------
  // HTTP methods
  // ---------------------------------------------------------------------------

  /**
   * Load audit logs from the REST API and populate the BehaviorSubject.
   * Call this once when the admin audit-log view initialises.
   */
  loadAuditLogs(params?: {
    user_id?: number;
    action?: string;
    resource_type?: string;
    limit?: number;
    offset?: number;
  }): Observable<{ items: AuditLog[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.user_id != null) query.set('user_id', String(params.user_id));
    if (params?.action) query.set('action', params.action);
    if (params?.resource_type) query.set('resource_type', params.resource_type);
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));

    const url = `${environment.apiBaseUrl}/audit/logs${query.toString() ? '?' + query.toString() : ''}`;

    return this.http.get<{ items: AuditLog[]; total: number }>(url).pipe(
      map((response) => {
        const enriched = response.items.map((log) => this.enrichLog(log));
        this.auditLogsSubject.next(enriched);
        return { ...response, items: enriched };
      })
    );
  }

  // ---------------------------------------------------------------------------
  // WebSocket subscription
  // ---------------------------------------------------------------------------

  private subscribeToWebSocketEvents(): void {
    this.wsSubscription = this.wsService.messages$
      .pipe(filter((msg) => msg.type === 'audit_log_created'))
      .subscribe((msg) => {
        this.handleAuditLogCreated(msg.data);
      });
  }

  /**
   * Handle incoming `audit_log_created` WebSocket event.
   * Maps the event payload fields to the AuditLog interface and prepends
   * the new entry to the BehaviorSubject without a full reload.
   */
  private handleAuditLogCreated(data: any): void {
    if (!data) return;

    const newLog: AuditLog = this.enrichLog({
      id: data.log_id,
      user_id: data.user_id ?? null,
      action: data.action,
      resource_type: data.entity_type ?? null,
      resource_id: data.entity_id ?? null,
      ip_address: data.ip_address ?? 'unknown',
      timestamp: data.timestamp ?? new Date().toISOString(),
      entity_type: data.entity_type ?? null,
      entity_id: data.entity_id ?? null,
    });

    const current = this.auditLogsSubject.getValue();
    this.auditLogsSubject.next([newLog, ...current]);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Enrich a raw AuditLog object with the `isCritical` flag.
   */
  private enrichLog(log: AuditLog): AuditLog {
    return {
      ...log,
      isCritical: CRITICAL_ACTIONS.has(log.action),
    };
  }
}
