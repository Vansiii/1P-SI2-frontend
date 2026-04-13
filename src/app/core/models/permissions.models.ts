/**
 * Models for permissions management
 */

export interface PermissionInfo {
  name: string;
  value: string;
  description: string;
}

export interface RoleInfo {
  name: string;
  value: string;
  description: string;
  can_modify: boolean;
  permission_count: number;
}

export interface RolePermissions {
  role: string;
  permissions: string[];
  total_permissions: number;
}

export interface UpdateRolePermissionsRequest {
  permissions: string[];
}

export interface UpdateRolePermissionsResponse {
  role: string;
  permissions: string[];
  added: string[];
  removed: string[];
  message: string;
}

export interface AllPermissionsResponse {
  permissions: PermissionInfo[];
  total: number;
}

export interface AllRolesResponse {
  roles: RoleInfo[];
  total: number;
}

export interface AllRolesPermissionsResponse {
  roles: RolePermissions[];
}
