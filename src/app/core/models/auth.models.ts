export interface WorkshopProfile {
  id: number;
  workshop_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface RegisterWorkshopRequest {
  workshop_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  password: string;
}

export interface LoginWorkshopRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: WorkshopProfile;
}
