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
      },
      {
        path: 'workshops',
        loadComponent: () => import('./features/admin/workshops-management/workshops-management').then(m => m.WorkshopsManagementComponent)
      },
      {
        path: 'audit-logs',
        loadComponent: () => import('./features/admin/audit-logs/audit-logs').then(m => m.AuditLogsComponent)
      },
      {
        path: 'unassigned-incidents',
        loadComponent: () => import('./features/admin/unassigned-incidents/unassigned-incidents').then(m => m.UnassignedIncidentsComponent)
      },
      {
        path: 'incident/:id',
        loadComponent: () => import('./features/admin/incident-detail-admin/incident-detail-admin').then(m => m.IncidentDetailAdminComponent)
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
      },
      { 
        path: 'technicians', 
        loadComponent: () => import('./features/workshop/technicians-management/technicians-management').then(m => m.TechniciansManagementComponent)
      }
    ]
  },
  {
    path: 'tracking',
    canActivate: [authGuard],
    children: [
      {
        path: 'incident/:id',
        loadComponent: () => import('./features/tracking/incident-tracking-view.component').then(m => m.IncidentTrackingViewComponent)
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
