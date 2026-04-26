import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Verifica si un JWT está expirado
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convertir a milisegundos
    return Date.now() >= exp;
  } catch {
    return true; // Si no se puede parsear, considerar expirado
  }
}

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si está autenticado
  if (!authService.isAuthenticated()) {
    console.log('🔒 Not authenticated, redirecting to /auth');
    return router.createUrlTree(['/auth']);
  }

  // Verificar si el token está expirado
  const token = authService.getAccessToken();
  if (token && isTokenExpired(token)) {
    console.log('⏰ Token expired, clearing session and redirecting to /auth');
    authService.clearSessionAndRedirect();
    return router.createUrlTree(['/auth']);
  }

  return true;
};
