export interface Supplier {
  id: number;
  tenant_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  tax_id?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierCreate {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  notes?: string;
}

export interface SupplierUpdate {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  notes?: string;
  is_active?: boolean;
}
