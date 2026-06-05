import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { OfflineQueueService } from '../services/offline-queue.service';
import { ConnectivityService } from '../services/connectivity.service';

const QUEUEABLE: { url: string; method: string; type: string }[] = [
  { url: '/api/v1/incidents/', method: 'POST', type: 'CREATE_INCIDENT' },
  { url: '/api/v1/incidents/', method: 'PATCH', type: 'UPDATE_INCIDENT' },
  { url: '/api/v1/incident-states/', method: 'POST', type: 'UPDATE_INCIDENT_STATUS' },
  { url: '/api/v1/cancellation/', method: 'POST', type: 'CANCEL_INCIDENT' },
  { url: '/api/v1/chat/', method: 'POST', type: 'SEND_CHAT_MESSAGE' },
  { url: '/api/v1/real-time/location', method: 'POST', type: 'UPDATE_LOCATION' },
  { url: '/api/v1/tracking/start', method: 'POST', type: 'TRACKING_START' },
  { url: '/api/v1/tracking/stop', method: 'POST', type: 'TRACKING_STOP' },
  { url: '/api/v1/tracking/technicians/', method: 'POST', type: 'UPDATE_LOCATION' },
  { url: '/api/v1/real-time/assign', method: 'POST', type: 'ASSIGN_TECHNICIAN' },
  { url: '/api/v1/real-time/arrived', method: 'POST', type: 'MARK_ARRIVED' },
  { url: '/api/v1/vehiculos', method: 'POST', type: 'CREATE_VEHICLE' },
  { url: '/api/v1/vehiculos', method: 'PATCH', type: 'UPDATE_VEHICLE' },
  { url: '/api/v1/vehiculos', method: 'DELETE', type: 'DELETE_VEHICLE' },
  { url: '/api/v1/incidents/', method: 'POST', type: 'SELECT_WORKSHOP' },
  { url: '/api/v1/workshop/catalog', method: 'POST', type: 'CREATE_CATALOG_ITEM' },
  { url: '/api/v1/workshop/catalog', method: 'PATCH', type: 'UPDATE_CATALOG_ITEM' },
  { url: '/api/v1/workshop/catalog', method: 'DELETE', type: 'DELETE_CATALOG_ITEM' },
];

function findMatch(req: { url: string; method: string }): {
  type: string;
  endpoint: string;
  method: string;
} | null {
  for (const entry of QUEUEABLE) {
    if (
      req.url.includes(entry.url) &&
      req.method.toUpperCase() === entry.method
    ) {
      return {
        type: entry.type,
        endpoint: req.url,
        method: req.method,
      };
    }
  }
  return null;
}

export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const queue = inject(OfflineQueueService);
  const connectivity = inject(ConnectivityService);

  if (!connectivity.online && req.method !== 'GET' && req.method !== 'HEAD') {
    const match = findMatch(req);
    if (match && req.body) {
      queue
        .add({
          type: match.type,
          endpoint: match.endpoint,
          method: match.method,
          body: req.body as Record<string, unknown>,
        })
        .catch(() => {});
    }
    return throwError(() => new HttpErrorResponse({
      status: 0,
      statusText: 'Offline — operación encolada',
      url: req.url,
    }));
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0 || err.status === 504 || err.status === 503) {
        const match = findMatch(req);
        if (match && req.body) {
          queue
            .add({
              type: match.type,
              endpoint: match.endpoint,
              method: match.method,
              body: req.body as Record<string, unknown>,
            })
            .catch(() => {});
        }
      }
      return throwError(() => err);
    })
  );
};
