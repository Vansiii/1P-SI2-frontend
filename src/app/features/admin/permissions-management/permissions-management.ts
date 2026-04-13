import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { PermissionsService } from '../../../core/services/permissions.service';
import { PermissionInfo, RoleInfo, RolePermissions } from '../../../core/models/permissions.models';

@Component({
  selector: 'app-permissions-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions-management.html',
  styleUrl: './permissions-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class PermissionsManagementComponent implements OnInit {
  private readonly permissionsService = inject(PermissionsService);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly allPermissions = signal<PermissionInfo[]>([]);
  readonly allRoles = signal<RoleInfo[]>([]);
  readonly selectedRole = signal<RoleInfo | null>(null);
  readonly rolePermissions = signal<string[]>([]);
  readonly searchTerm = signal('');

  // Computed values
  readonly filteredPermissions = computed(() => {
    const search = this.searchTerm().toLowerCase();
    if (!search) return this.allPermissions();
    
    return this.allPermissions().filter(
      (perm) =>
        perm.name.toLowerCase().includes(search) ||
        perm.value.toLowerCase().includes(search) ||
        perm.description.toLowerCase().includes(search)
    );
  });

  readonly modifiableRoles = computed(() => {
    return this.allRoles().filter((role) => role.can_modify);
  });

  readonly selectedRolePermissionSet = computed(() => {
    return new Set(this.rolePermissions());
  });

  readonly permissionsByCategory = computed(() => {
    const permissions = this.filteredPermissions();
    const categories = new Map<string, PermissionInfo[]>();

    permissions.forEach((perm) => {
      const category = perm.value.split(':')[0] || 'other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(perm);
    });

    return Array.from(categories.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Load permissions and roles in parallel
    Promise.all([
      this.permissionsService.getAllPermissions().toPromise(),
      this.permissionsService.getAllRoles().toPromise(),
    ])
      .then(([permissionsResponse, rolesResponse]) => {
        if (permissionsResponse) {
          this.allPermissions.set(permissionsResponse.permissions);
        }
        if (rolesResponse) {
          this.allRoles.set(rolesResponse.roles);
        }
      })
      .catch((error) => {
        this.error.set(this.extractErrorMessage(error, 'Error al cargar datos'));
      })
      .finally(() => {
        this.isLoading.set(false);
      });
  }

  selectRole(role: RoleInfo): void {
    if (!role.can_modify) {
      this.error.set(`No se pueden modificar los permisos del rol ${role.value}`);
      return;
    }

    this.selectedRole.set(role);
    this.error.set(null);
    this.success.set(null);
    this.isLoading.set(true);

    this.permissionsService
      .getRolePermissions(role.value)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.rolePermissions.set(response.permissions);
        },
        error: (error) => {
          this.error.set(this.extractErrorMessage(error, 'Error al cargar permisos del rol'));
        },
      });
  }

  togglePermission(permissionValue: string): void {
    const currentPerms = this.rolePermissions();
    const index = currentPerms.indexOf(permissionValue);

    if (index > -1) {
      // Remove permission
      this.rolePermissions.set(currentPerms.filter((p) => p !== permissionValue));
    } else {
      // Add permission
      this.rolePermissions.set([...currentPerms, permissionValue]);
    }
  }

  isPermissionSelected(permissionValue: string): boolean {
    return this.selectedRolePermissionSet().has(permissionValue);
  }

  savePermissions(): void {
    const role = this.selectedRole();
    if (!role) return;

    this.isSaving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.permissionsService
      .updateRolePermissions(role.value, this.rolePermissions())
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.success.set(
            `Permisos actualizados: ${response.added.length} agregados, ${response.removed.length} removidos`
          );
          // Update role info
          const updatedRoles = this.allRoles().map((r) =>
            r.value === role.value ? { ...r, permission_count: response.permissions.length } : r
          );
          this.allRoles.set(updatedRoles);
          
          // Clear success message after 5 seconds
          setTimeout(() => this.success.set(null), 5000);
        },
        error: (error) => {
          this.error.set(this.extractErrorMessage(error, 'Error al actualizar permisos'));
        },
      });
  }

  selectAllInCategory(permissions: PermissionInfo[]): void {
    const currentPerms = new Set(this.rolePermissions());
    permissions.forEach((perm) => currentPerms.add(perm.value));
    this.rolePermissions.set(Array.from(currentPerms));
  }

  deselectAllInCategory(permissions: PermissionInfo[]): void {
    const permsToRemove = new Set(permissions.map((p) => p.value));
    this.rolePermissions.set(this.rolePermissions().filter((p) => !permsToRemove.has(p)));
  }

  resetPermissions(): void {
    const role = this.selectedRole();
    if (role) {
      this.selectRole(role);
    }
  }

  getCategoryName(category: string): string {
    const names: Record<string, string> = {
      auth: 'Autenticación',
      password: 'Contraseñas',
      profile: 'Perfil',
      vehicle: 'Vehículos',
      emergency: 'Emergencias',
      workshop: 'Talleres',
      technician: 'Técnicos',
      communication: 'Comunicación',
      rating: 'Calificaciones',
      ai: 'Inteligencia Artificial',
      assignment: 'Asignación',
      payment: 'Pagos',
      notification: 'Notificaciones',
      report: 'Reportes',
      admin: 'Administración',
      audit: 'Auditoría',
      system: 'Sistema',
    };
    return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): string {
    const maybeHttpError = error as {
      error?: {
        error?: {
          message?: string;
        };
        detail?: unknown;
      };
    };

    const backendError = maybeHttpError.error?.error;
    if (backendError && typeof backendError.message === 'string') {
      return backendError.message;
    }

    const detail = maybeHttpError.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object') {
      const detailMessage = (detail as { message?: unknown }).message;
      if (typeof detailMessage === 'string') {
        return detailMessage;
      }
    }

    return fallbackMessage;
  }
}
