export type UserType = 'client' | 'workshop' | 'technician' | 'administrator' | 'admin';

export interface AppUserProfile {
  id: number;
  email: string;
  user_type: UserType | string;
  role?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  phone?: string | null;
  mfa_enabled?: boolean;
  two_factor_enabled?: boolean;
  first_name?: string;
  last_name?: string;
  workshop_name?: string;
  owner_name?: string;
  workshop_phone?: string | null;
  address?: string | null;
  description?: string | null;
  direccion?: string | null;
  coverage_radius_km?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  is_available?: boolean;
  is_on_duty?: boolean;
  workshop_id?: number;
  role_level?: string | null;
  current_latitude?: number | null;
  current_longitude?: number | null;
  email_verified?: boolean;
  last_login?: string | null;
  last_password_change_at?: string | null;
}

export interface RegisterWorkshopRequest {
  first_name: string;
  last_name: string;
  phone: string;
  workshop_name: string;
  owner_name: string;
  address?: string | null;
  email: string;
  password: string;
  latitude: number;
  longitude: number;
  coverage_radius_km: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AppUserProfile;
  user_type?: UserType | string;
}

export interface Login2FAChallenge {
  requires_2fa: true;
  email: string;
  message: string;
}

export interface LoginSuccess {
  requires_2fa: false;
  tokens: AuthTokenResponse;
}

export type LoginResult = Login2FAChallenge | LoginSuccess;

export interface ProfileUpdateRequest {
  direccion?: string;
  workshop_name?: string;
  owner_name?: string;
  latitude?: number;
  longitude?: number;
  coverage_radius_km?: number;
  current_latitude?: number;
  current_longitude?: number;
  is_available?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface DeleteAccountRequest {
  current_password: string;
}

