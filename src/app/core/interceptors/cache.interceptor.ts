import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { OfflineCacheService } from '../services/offline-cache.service';

const SKIP_CACHE_PATTERNS = [
  '/auth/',
  '/tokens/',
  '/webhooks/',
  '/sync/',
];

function shouldCache(url: string, method: string): boolean {
  if (method !== 'GET') return false;
  return !SKIP_CACHE_PATTERNS.some((p) => url.includes(p));
}

function cacheKey(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '');
}

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (!shouldCache(req.url, req.method)) {
    return next(req);
  }

  const offlineCache = inject(OfflineCacheService);

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        void offlineCache.put('api_cache', cacheKey(req.url), { data: event.body, status: event.status });
      }
    }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0 || err.status === 504 || err.status === 503) {
        return new Promise<any>((resolve, reject) => {
          offlineCache.get<any>('api_cache', cacheKey(req.url)).then((cached) => {
            if (cached) {
              console.log(`📦 Served from offline cache: ${cacheKey(req.url)}`);
              resolve(new HttpResponse({ body: cached.data, status: 200, url: req.url }));
            } else {
              reject(err);
            }
          }).catch(() => {
            reject(err);
          });
        });
      }
      return throwError(() => err);
    })
  );
};
