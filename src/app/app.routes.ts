import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicOnlyGuard } from './core/guards/public-only.guard';
import { AuthPageComponent } from './features/auth/auth-page';
import { DashboardPageComponent } from './features/dashboard/dashboard-page';
import { HomePageComponent } from './features/home/home-page';
import { PrivateShellComponent } from './layouts/private-shell/private-shell';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    canActivate: [publicOnlyGuard],
  },
  {
    path: 'auth',
    canActivate: [publicOnlyGuard],
    children: [
      { path: '', component: AuthPageComponent },
      {
        path: '',
        loadComponent: () => import('./layouts/minimal-auth-layout/minimal-auth-layout').then(m => m.MinimalAuthLayout),
        children: [
          { 
            path: 'forgot-password', 
            loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
          },
          { 
            path: 'reset-password', 
            loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword)
          },
          {
            path: 'verify-two-factor',
            redirectTo: '2fa',
            pathMatch: 'full',
          },
          { 
            path: '2fa', 
            loadComponent: () => import('./features/auth/verify-two-factor/verify-two-factor').then(m => m.VerifyTwoFactor)
          }
        ]
      }
    ]
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    component: PrivateShellComponent,
    children: [
      { path: '', component: DashboardPageComponent }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    component: PrivateShellComponent,
    children: [
      { 
        path: 'permissions', 
        loadComponent: () => import('./features/admin/permissions-management/permissions-management').then(m => m.PermissionsManagementComponent)
      }
    ]
  },
  {
    path: 'workshop',
    canActivate: [authGuard],
    component: PrivateShellComponent,
    children: [
      { 
        path: 'incidents', 
        loadComponent: () => import('./features/workshop/incidents-list/incidents-list').then(m => m.IncidentsListComponent)
      }
    ]
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/minimal-profile-layout/minimal-profile-layout').then(m => m.MinimalProfileLayout),
    children: [
      { 
        path: '', 
        loadComponent: () => import('./features/profile/profile-page/profile-page').then(m => m.ProfilePage)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFoundComponent),
  },
];
