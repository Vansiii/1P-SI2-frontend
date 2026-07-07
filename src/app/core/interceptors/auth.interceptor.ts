import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, Subject, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

let isRefreshing = false;
let refreshSubject: Subject<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const http = inject(HttpClient);
  const accessToken = authService.getAccessToken();

  if (!accessToken) {
    return next(request).pipe(
      catchError((error) => {
        _logError(error);
        return throwError(() => error);
      })
    );
  }

  const authorizedRequest = request.clone({
    setHeaders: { Authorization: `Bearer ${accessToken}` },
  });

  return next(authorizedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      _logError(error);

      if (error.status === 401 && !request.url.includes('/tokens/refresh')) {
        if (!isRefreshing) {
          return handleTokenRefresh(request, next, authService, http);
        }
        return refreshSubject!.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((newToken) => {
            return next(request.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            }));
          })
        );
      }

      if (error.status === 403) {
        const detail = error.error?.detail || '';
        const router = inject(Router);
        if (detail.includes('pendiente') || detail.includes('aprobacion')) {
          router.navigate(['/account-pending']);
        } else if (detail.includes('suspendida') || detail.includes('suspendido')) {
          router.navigate(['/account-suspended']);
        } else if (detail.includes('cancelada') || detail.includes('cancelado')) {
          router.navigate(['/account-suspended']);
        }
      }

      return throwError(() => error);
    })
  );
};

function handleTokenRefresh(
  request: HttpRequest<any>,
  next: HttpHandlerFn,
  authService: AuthService,
  http: HttpClient
): Observable<HttpEvent<any>> {
  isRefreshing = true;
  refreshSubject = new Subject<string | null>();

  const refreshToken = authService.getRefreshToken();

  if (!refreshToken) {
    _finishRefresh(null);
    authService.clearSessionAndRedirect();
    return throwError(() => new Error('No refresh token available'));
  }

  return http.post<any>(`${environment.apiUrl}/tokens/refresh`, {
    refresh_token: refreshToken
  }).pipe(
    switchMap((response) => {
      const newAccessToken = response.data?.tokens?.access_token
        || response.data?.access_token
        || response.access_token;
      const newRefreshToken = response.data?.tokens?.refresh_token
        || response.data?.refresh_token
        || response.refresh_token;

      if (newAccessToken) {
        authService.updateTokens(newAccessToken, newRefreshToken || refreshToken);
        _finishRefresh(newAccessToken);
        return next(request.clone({
          setHeaders: { Authorization: `Bearer ${newAccessToken}` },
        }));
      }

      _finishRefresh(null);
      authService.clearSessionAndRedirect();
      return throwError(() => new Error('No access token in refresh response'));
    }),
    catchError((error) => {
      _finishRefresh(null);
      authService.clearSessionAndRedirect();
      return throwError(() => error);
    })
  );
}

function _finishRefresh(token: string | null): void {
  isRefreshing = false;
  if (refreshSubject) {
    if (token) {
      refreshSubject.next(token);
    }
    refreshSubject.complete();
    refreshSubject = null;
  }
}

function _logError(error: any): void {
  if (!environment.production) {
    if (error instanceof HttpErrorResponse) {
      console.warn(`[Auth] ${error.status} ${error.url} — ${error.message}`);
    }
  }
}
