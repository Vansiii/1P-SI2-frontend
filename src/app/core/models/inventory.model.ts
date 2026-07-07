export interface InventoryProduct {
  id: number;
  tenant_id: number;
  category_id?: number;
  category_name?: string;
  supplier_id?: number;
  supplier_name?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  brand?: string;
  part_number?: string;
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  unit: string;
  location?: string;
  cost_price: number;
  avg_cost_price: number;
  compatible_brands?: string[];
  compatible_models?: string[];
  compatible_years?: { min?: number; max?: number };
  universal: boolean;
  is_active: boolean;
  is_published: boolean;
  image_url?: string;
  images?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface InventoryMovement {
  id: number;
  tenant_id: number;
  product_id: number;
  product_name: string;
  product_sku?: string;
  type: 'entrada' | 'salida' | 'ajuste' | 'devolucion';
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_type?: string;
  reference_id?: number;
  stock_before: number;
  stock_after: number;
  notes?: string;
  created_by: number;
  created_at?: string;
}

export interface InventoryCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  parent_id?: number;
  parent_name?: string;
  is_active: boolean;
}

export interface StockAlert {
  id: number;
  product_id: number;
  product_name: string;
  product_sku?: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock';
  current_stock: number;
  threshold: number;
  is_read: boolean;
  is_resolved: boolean;
  created_at?: string;
}

export interface InventoryDashboardData {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_value: number;
  categories_count: number;
  recent_movements: InventoryMovement[];
}
