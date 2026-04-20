import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { WebSocketService } from './websocket.service';

/**
 * Evidence entity as returned by the backend.
 * Validates: Requirements REQ-8 (Evidence Management Real-Time Events)
 */
export interface Evidence {
  id: number;
  incident_id: number;
  evidence_type: 'text' | 'image' | 'audio';
  file_url: string | null;
  description?: string;
  uploaded_by_user_id: number;
  created_at: string;
}

/** Payload for evidence_uploaded / evidence_image_uploaded / evidence_audio_uploaded */
interface EvidenceUploadedPayload {
  evidence_id: number;
  incident_id: number;
  evidence_type: 'text' | 'image' | 'audio';
  file_url: string | null;
  timestamp: string;
}

/** Payload for evidence_deleted */
interface EvidenceDeletedPayload {
  evidence_id: number;
  incident_id: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class EvidenceService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  // ── Reactive state ────────────────────────────────────────────────────────

  /** All evidence items currently loaded, keyed by incident. */
  private evidenceSubject = new BehaviorSubject<Evidence[]>([]);
  public evidence$ = this.evidenceSubject.asObservable();

  /**
   * Derived observable: count of evidence items per incident_id.
   * Components can use this to display counters on incident cards without
   * subscribing to the full evidence list.
   *
   * Validates: Requirements REQ-8.7 (update evidence counters in incident cards)
   */
  public evidenceCountByIncident$: Observable<Map<number, number>> =
    this.evidence$.pipe(
      map(items => {
        const counts = new Map<number, number>();
        for (const item of items) {
          counts.set(item.incident_id, (counts.get(item.incident_id) ?? 0) + 1);
        }
        return counts;
      })
    );

  constructor() {
    this.subscribeToWebSocket();
  }

  // ── WebSocket handlers ────────────────────────────────────────────────────

  /**
   * Subscribe to all evidence-related WebSocket events.
   * Validates: Requirements REQ-8.1, REQ-8.2, REQ-8.3, REQ-8.4
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'evidence_uploaded':
          this.handleEvidenceUploaded(message.data as EvidenceUploadedPayload);
          break;
        case 'evidence_image_uploaded':
          this.handleEvidenceUploaded(message.data as EvidenceUploadedPayload);
          break;
        case 'evidence_audio_uploaded':
          this.handleEvidenceUploaded(message.data as EvidenceUploadedPayload);
          break;
        case 'evidence_deleted':
          this.handleEvidenceDeleted(message.data as EvidenceDeletedPayload);
          break;
      }
    });
  }

  /**
   * Append newly uploaded evidence to the list without reloading all evidence.
   * Validates: Requirements REQ-8.6
   */
  private handleEvidenceUploaded(data: EvidenceUploadedPayload): void {
    // Avoid duplicates: if the evidence_id is already present, skip
    const existing = this.evidenceSubject.value.find(e => e.id === data.evidence_id);
    if (existing) {
      return;
    }

    const newEvidence: Evidence = {
      id: data.evidence_id,
      incident_id: data.incident_id,
      evidence_type: data.evidence_type,
      file_url: data.file_url ?? null,
      uploaded_by_user_id: 0, // not provided in WS payload; will be filled on full reload
      created_at: data.timestamp,
    };

    this.evidenceSubject.next([...this.evidenceSubject.value, newEvidence]);
    console.log(
      `✅ Evidence ${data.evidence_id} (${data.evidence_type}) appended for incident ${data.incident_id}`
    );
  }

  /**
   * Remove deleted evidence from the list.
   * Validates: Requirements REQ-8.4, REQ-8.6
   */
  private handleEvidenceDeleted(data: EvidenceDeletedPayload): void {
    const filtered = this.evidenceSubject.value.filter(e => e.id !== data.evidence_id);
    this.evidenceSubject.next(filtered);
    console.log(
      `✅ Evidence ${data.evidence_id} removed from incident ${data.incident_id}`
    );
  }

  // ── HTTP methods ──────────────────────────────────────────────────────────

  /**
   * Load all evidence for a given incident and populate the BehaviorSubject.
   */
  getEvidenceForIncident(incidentId: number): Observable<Evidence[]> {
    return this.http
      .get<ApiResponse<Evidence[]>>(`${this.apiUrl}/${incidentId}/evidencias`)
      .pipe(
        map(response => {
          // Merge: keep items from other incidents, replace items for this incident
          const others = this.evidenceSubject.value.filter(
            e => e.incident_id !== incidentId
          );
          const merged = [...others, ...response.data];
          this.evidenceSubject.next(merged);
          return response.data;
        })
      );
  }

  /**
   * Get evidence items for a specific incident from the current state.
   */
  getEvidenceByIncident(incidentId: number): Evidence[] {
    return this.evidenceSubject.value.filter(e => e.incident_id === incidentId);
  }

  /**
   * Get the evidence count for a specific incident from the current state.
   * Validates: Requirements REQ-8.7
   */
  getEvidenceCount(incidentId: number): number {
    return this.evidenceSubject.value.filter(e => e.incident_id === incidentId).length;
  }

  /**
   * Delete evidence by ID.
   */
  deleteEvidence(incidentId: number, evidenceId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(
        `${this.apiUrl}/${incidentId}/evidencias/${evidenceId}`
      )
      .pipe(map(() => undefined));
  }
}
