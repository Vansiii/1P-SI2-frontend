import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicOnlyGuard } from './core/guards/public-only.guard';
import { AuthPageComponent } from './features/auth/auth-page';
import { DashboardPageComponent } from './features/dashboard/dashboard-page';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'auth',
	},
	{
		path: 'auth',
		component: AuthPageComponent,
		canActivate: [publicOnlyGuard],
	},
	{
		path: 'dashboard',
		component: DashboardPageComponent,
		canActivate: [authGuard],
	},
	{
		path: '**',
		redirectTo: 'auth',
	},
];
