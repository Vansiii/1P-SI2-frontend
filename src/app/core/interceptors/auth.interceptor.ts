import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();

  if (!accessToken) {
    return next(request).pipe(
      tap({
        error: (error) => {
          if (error instanceof HttpErrorResponse) {
            console.log('🔴 HTTP Error Response:', {
              status: error.status,
              statusText: error.statusText,
              url: error.url,
              error: error.error,
              message: error.message,
            });
          } else {
            console.log('🔴 Unknown Error:', error);
          }
        }
      })
    );
  }

  const authorizedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authorizedRequest).pipe(
    tap({
      error: (error) => {
        if (error instanceof HttpErrorResponse) {
          console.log('🔴 HTTP Error Response:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            error: error.error,
            message: error.message,
          });
        } else {
          console.log('🔴 Unknown Error:', error);
        }
      }
    })
  );
};
