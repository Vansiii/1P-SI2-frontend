import { Injectable, inject } from '@angular/core';
import { IncidentsStateService } from './incidents-state.service';
import { Incident } from '../models/incident.model';

/**
 * TimeoutVerificationService
 * 
 * Verifies and updates timeout status for incidents.
 * Runs periodically to check if assigned incidents have timed out.
 * 
 * Requirements: 6.1, 6.4, 6.5, 6.6, 6.9
 */
@Injectable({
  providedIn: 'root'
})
export class TimeoutVerificationService {
  private incidentsStateService = inject(IncidentsStateService);

  /**
   * Verify timeouts for all incidents
   */
  verifyTimeouts(): void {
    const incidents = this.incidentsStateService.incidents();
    const now = new Date();

    incidents.forEach(incident => {
      if (this.shouldCheckTimeout(incident)) {
        const hasTimedOut = this.checkTimeout(incident, now);
        
        if (hasTimedOut && !incident.has_timeout) {
          console.log(`Incident ${incident.id} has timed out`);
          this.incidentsStateService.updateIncident(incident.id, {
            has_timeout: true
          });
        }
      }
    });
  }

  /**
   * Check if incident should be checked for timeout
   */
  shouldCheckTimeout(incident: Incident): boolean {
    return (
      incident.estado === 'asignado' &&
      incident.suggested_technician !== null &&
      incident.suggested_technician.timeout_at !== null
    );
  }

  /**
   * Check if incident has timed out
   */
  checkTimeout(incident: Incident, now: Date): boolean {
    if (!incident.suggested_technician?.timeout_at) {
      return false;
    }

    const timeoutDate = new Date(incident.suggested_technician.timeout_at);
    return now >= timeoutDate;
  }

  /**
   * Calculate time remaining until timeout (in minutes)
   */
  calculateTimeRemaining(incident: Incident): number | null {
    if (!incident.suggested_technician?.timeout_at) {
      return null;
    }

    const timeoutDate = new Date(incident.suggested_technician.timeout_at);
    const now = new Date();
    const diffMs = timeoutDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return null;
    }

    return Math.floor(diffMs / 60000); // Convert to minutes
  }

  /**
   * Check if incident is in timeout warning period (< 2 minutes remaining)
   */
  isTimeoutWarning(incident: Incident): boolean {
    const timeRemaining = this.calculateTimeRemaining(incident);
    return timeRemaining !== null && timeRemaining < 2 && timeRemaining > 0;
  }
}
