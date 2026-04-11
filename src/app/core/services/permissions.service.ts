import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AllPermissionsResponse,
  AllRolesPermissionsResponse,
  AllRolesResponse,
  RolePermissions,
  UpdateRolePermissionsRequest,
  UpdateRolePermissionsResponse,
} from '../models/permissions.models';

interface ApiResponse<T> {
  data: T;
  message?: string;
  request_id?: string;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  /**
   * Get all available permissions in the system
   */
  getAllPermissions(): Observable<AllPermissionsResponse> {
    return this.httpClient
      .get<ApiResponse<AllPermissionsResponse>>(`${this.apiBaseUrl}/admin/permissions`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get all roles information
   */
  getAllRoles(): Observable<AllRolesResponse> {
    return this.httpClient
      .get<ApiResponse<AllRolesResponse>>(`${this.apiBaseUrl}/admin/roles`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get all roles with their permissions
   */
  getAllRolesPermissions(): Observable<AllRolesPermissionsResponse> {
    return this.httpClient
      .get<ApiResponse<AllRolesPermissionsResponse>>(`${this.apiBaseUrl}/admin/roles/permissions`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get permissions for a specific role
   */
  getRolePermissions(role: string): Observable<RolePermissions> {
    return this.httpClient
      .get<ApiResponse<RolePermissions>>(`${this.apiBaseUrl}/admin/roles/${role}/permissions`)
      .pipe(map((response) => response.data));
  }

  /**
   * Update permissions for a role (replace all)
   */
  updateRolePermissions(
    role: string,
    permissions: string[]
  ): Observable<UpdateRolePermissionsResponse> {
    const request: UpdateRolePermissionsRequest = { permissions };
    return this.httpClient
      .put<ApiResponse<UpdateRolePermissionsResponse>>(
        `${this.apiBaseUrl}/admin/roles/${role}/permissions`,
        request
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Add permissions to a role (without removing existing ones)
   */
  addPermissionsToRole(
    role: string,
    permissions: string[]
  ): Observable<UpdateRolePermissionsResponse> {
    const request: UpdateRolePermissionsRequest = { permissions };
    return this.httpClient
      .post<ApiResponse<UpdateRolePermissionsResponse>>(
        `${this.apiBaseUrl}/admin/roles/${role}/permissions/add`,
        request
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Remove permissions from a role
   */
  removePermissionsFromRole(
    role: string,
    permissions: string[]
  ): Observable<UpdateRolePermissionsResponse> {
    const request: UpdateRolePermissionsRequest = { permissions };
    return this.httpClient
      .post<ApiResponse<UpdateRolePermissionsResponse>>(
        `${this.apiBaseUrl}/admin/roles/${role}/permissions/remove`,
        request
      )
      .pipe(map((response) => response.data));
  }
}
