import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const publicOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Permitir acceso si no está autenticado
  if (!authService.isAuthenticated()) {
    return true;
  }

  // Si está autenticado Y tiene un usuario válido, redirigir al dashboard
  const currentUser = authService.currentUser();
  if (currentUser) {
    if (!authService.isWebUserTypeAllowed(currentUser.user_type)) {
      authService.clearSessionAndRedirect();
      return true;
    }
    return router.createUrlTree([authService.getDefaultRouteForCurrentUser()]);
  }

  // Si tiene token pero no usuario (sesión inválida), permitir acceso
  return true;
};
