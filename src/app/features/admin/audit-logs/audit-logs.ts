import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';

interface AuditLog {
  id: number;
  user_id: number;
  user_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string;
  timestamp: string;
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly logs = signal<AuditLog[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly totalLogs = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = 20;

  // Filters
  readonly filterAction = signal('');
  readonly filterUserType = signal('');
  readonly filterResourceType = signal('');
  readonly selectedLog = signal<AuditLog | null>(null);

  readonly filteredLogs = computed(() => {
    const action = this.filterAction().toLowerCase();
    const userType = this.filterUserType().toLowerCase();
    const resourceType = this.filterResourceType().toLowerCase();

    return this.logs().filter((log) => {
      const matchesAction = !action || log.action.toLowerCase().includes(action);
      const matchesUserType = !userType || log.user_type.toLowerCase().includes(userType);
      const matchesResourceType = !resourceType || log.resource_type.toLowerCase().includes(resourceType);

      return matchesAction && matchesUserType && matchesResourceType;
    });
  });

  readonly totalPages = computed(() => 
    Math.ceil(this.totalLogs() / this.pageSize)
  );

  readonly userTypes = ['client', 'workshop', 'technician', 'admin'];
  readonly actions = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW'];
  readonly resourceTypes = ['USER', 'WORKSHOP', 'INCIDENT', 'SERVICE', 'AUTH'];

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const skip = (this.currentPage() - 1) * this.pageSize;

    this.adminService
      .getAuditLogs({
        skip,
        limit: this.pageSize,
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ logs, total }) => {
          this.logs.set(logs);
          this.totalLogs.set(total);
        },
        error: (error) => {
          this.errorMessage.set(
            error?.error?.message || 'Error al cargar bitácora'
          );
        },
      });
  }

  selectLog(log: AuditLog): void {
    this.selectedLog.set(log);
  }

  closeDetails(): void {
    this.selectedLog.set(null);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadLogs();
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  getActionClass(action: string): string {
    const classes: Record<string, string> = {
      LOGIN: 'action-login',
      LOGOUT: 'action-logout',
      CREATE: 'action-create',
      UPDATE: 'action-update',
      DELETE: 'action-delete',
      VIEW: 'action-view',
    };
    return classes[action] || 'action-default';
  }

  getUserTypeLabel(userType: string): string {
    const labels: Record<string, string> = {
      client: 'Cliente',
      workshop: 'Taller',
      technician: 'Técnico',
      admin: 'Administrador',
    };
    return labels[userType] || userType;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDetails(details: Record<string, any> | null): string {
    if (!details) return 'Sin detalles';
    return JSON.stringify(details, null, 2);
  }

  clearFilters(): void {
    this.filterAction.set('');
    this.filterUserType.set('');
    this.filterResourceType.set('');
  }
}
