import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() >= exp;
  } catch {
    return true;
  }
}

function parseJwtPayload(token: string): any {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }

  const token = authService.getAccessToken();
  if (token && isTokenExpired(token)) {
    authService.clearSessionAndRedirect();
    return router.createUrlTree(['/auth']);
  }

  const payload = parseJwtPayload(token!);
  const userType = authService.normalizeUserType(payload.user_type ?? authService.currentUser()?.user_type);

  if (!authService.isWebUserTypeAllowed(userType)) {
    authService.clearSessionAndRedirect();
    return router.createUrlTree(['/auth']);
  }

  const routePaths = route.pathFromRoot
    .map(snapshot => snapshot.routeConfig?.path)
    .filter((path): path is string => Boolean(path));

  if (routePaths.includes('admin') && !authService.isAdminUserType(userType))
    return router.createUrlTree([authService.getDefaultRouteForUser(userType)]);

  if (routePaths.includes('workshop') && userType !== 'workshop')
    return router.createUrlTree([authService.getDefaultRouteForUser(userType)]);

  if (userType !== 'workshop') {
    return true;
  }

  const path = route.routeConfig?.path || '';

  if (path === 'profile' || path === 'dashboard' || path === '' || path === 'subscription') {
    return true;
  }

  const tenantStatus = payload.tenant_status || authService.tenantStatus();

  if (tenantStatus === 'rejected') {
    return router.createUrlTree(['/account-rejected']);
  }
  if (tenantStatus === 'suspended' || tenantStatus === 'canceled') {
    return router.createUrlTree(['/account-suspended']);
  }

  if (tenantStatus !== 'pending') {
    return true;
  }

  if (!navigator.onLine) {
    return true;
  }

  return authService.fetchCurrentUser().pipe(
    map(() => {
      const freshStatus = authService.tenantStatus();
      if (freshStatus === 'active') {
        return true;
      }
      return router.createUrlTree(['/account-pending']);
    }),
    catchError(() => {
      if (!navigator.onLine) {
        return of(true);
      }
      return of(router.createUrlTree(['/account-pending']));
    })
  );
};
