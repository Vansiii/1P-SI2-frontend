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
    path: 'account-pending',
    loadComponent: () => import('./features/workshop/account-pending/account-pending').then(m => m.AccountPendingComponent)
  },
  {
    path: 'account-rejected',
    loadComponent: () => import('./features/workshop/account-rejected/account-rejected').then(m => m.AccountRejectedComponent)
  },
  {
    path: 'account-suspended',
    loadComponent: () => import('./features/workshop/account-suspended/account-suspended').then(m => m.AccountSuspendedComponent)
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
        path: 'monitoring',
        loadComponent: () => import('./features/admin/system-monitoring/system-monitoring').then(m => m.SystemMonitoringComponent)
      },
      {
        path: 'unassigned-incidents',
        redirectTo: 'monitoring',
        pathMatch: 'full'
      },
      {
        path: 'incident/:id',
        loadComponent: () => import('./features/admin/incident-detail-admin/incident-detail-admin').then(m => m.IncidentDetailAdminComponent)
      },
      {
        path: 'withdrawals',
        loadComponent: () => import('./features/admin/withdrawals-management/withdrawals-management').then(m => m.WithdrawalsManagementComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/admin/reports/admin-reports').then(m => m.AdminReportsComponent)
      },
      {
        path: 'tenant-requests',
        loadComponent: () => import('./features/admin/tenant-requests/tenant-requests').then(m => m.TenantRequestsComponent)
      },
      {
        path: 'subscriptions',
        loadComponent: () => import('./features/admin/subscription-management/subscription-management').then(m => m.SubscriptionManagementComponent)
      },
      {
        path: 'plans',
        loadComponent: () => import('./features/admin/plan-management/plan-management').then(m => m.PlanManagementComponent)
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
        path: 'incidents/map', 
        loadComponent: () => import('./features/workshop/workshop-map-page/workshop-map-page').then(m => m.WorkshopMapPageComponent)
      },
      { 
        path: 'incidents/:id', 
        loadComponent: () => import('./features/workshop/incident-detail/incident-detail').then(m => m.WorkshopIncidentDetailComponent)
      },
      { 
        path: 'technicians', 
        loadComponent: () => import('./features/workshop/technicians-management/technicians-management').then(m => m.TechniciansManagementComponent)
      },
      {
        path: 'wallet',
        loadComponent: () => import('./features/workshop/wallet/wallet').then(m => m.WorkshopWalletComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/workshop/reports/workshop-reports').then(m => m.WorkshopReportsComponent)
      },
      {
        path: 'subscription',
        loadComponent: () => import('./features/workshop/subscription/subscription').then(m => m.SubscriptionPageComponent)
      },
      {
        path: 'catalog',
        loadComponent: () => import('./features/workshop/service-catalog/service-catalog.component').then(m => m.ServiceCatalogComponent)
      },
      {
        path: 'cotizaciones',
        loadComponent: () => import('./features/workshop/cotizaciones-list/cotizaciones-list').then(m => m.CotizacionesListComponent)
      },
      {
        path: 'cotizaciones/:id',
        loadComponent: () => import('./features/workshop/cotizacion-detalle/cotizacion-detalle').then(m => m.CotizacionDetalleComponent)
      },
      {
        path: 'suppliers',
        loadComponent: () => import('./features/workshop/suppliers-list/suppliers-list.component').then(m => m.SuppliersListComponent)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/workshop/inventory-list/inventory-list.component').then(m => m.InventoryListComponent)
      },
      {
        path: 'inventory/new',
        loadComponent: () => import('./features/workshop/inventory-form/inventory-form.component').then(m => m.InventoryFormComponent)
      },
      {
        path: 'inventory/movements',
        loadComponent: () => import('./features/workshop/inventory-movements/inventory-movements.component').then(m => m.InventoryMovementsComponent)
      },
      {
        path: 'inventory/:id',
        loadComponent: () => import('./features/workshop/inventory-detail/inventory-detail.component').then(m => m.InventoryDetailComponent)
      },
      {
        path: 'inventory/:id/edit',
        loadComponent: () => import('./features/workshop/inventory-form/inventory-form.component').then(m => m.InventoryFormComponent)
      },
      {
        path: 'marketplace/products',
        loadComponent: () => import('./features/workshop/marketplace-products/marketplace-products.component').then(m => m.MarketplaceProductsComponent)
      },
      {
        path: 'marketplace/publish',
        loadComponent: () => import('./features/workshop/publish-product/publish-product.component').then(m => m.PublishProductComponent)
      },
      {
        path: 'promotions',
        loadComponent: () => import('./features/workshop/promotions-manager/promotions-manager.component').then(m => m.PromotionsManagerComponent)
      }
    ]
  },
  {
    path: 'cotizaciones/mapa/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/workshop/cotizacion-mapa/cotizacion-mapa').then(m => m.CotizacionMapaComponent)
  },
  {
    path: 'cotizaciones',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/cotizaciones/cotizaciones-cliente').then(m => m.CotizacionesClienteComponent)
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
    path: 'marketplace',
    canActivate: [authGuard],
    component: PrivateShellComponent,
    children: [
      {
        path: 'browse',
        loadComponent: () => import('./features/marketplace/browse/marketplace-browse.component').then(m => m.MarketplaceBrowseComponent)
      },
      {
        path: 'listing/:id',
        loadComponent: () => import('./features/marketplace/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'cart',
        loadComponent: () => import('./features/marketplace/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        loadComponent: () => import('./features/marketplace/checkout/checkout.component').then(m => m.CheckoutComponent)
      },
      {
        path: 'my-purchases',
        loadComponent: () => import('./features/marketplace/order-history/order-history.component').then(m => m.OrderHistoryComponent)
      },
      {
        path: 'order/:id',
        loadComponent: () => import('./features/marketplace/order-detail/order-detail.component').then(m => m.OrderDetailComponent)
      },
      {
        path: 'compare',
        loadComponent: () => import('./features/marketplace/product-compare/product-compare.component').then(m => m.ProductCompareComponent)
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
