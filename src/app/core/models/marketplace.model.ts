export interface MarketplaceListing {
  id: number;
  tenant_id: number;
  product_id: number;
  public_price: number;
  compare_at_price?: number;
  is_visible: boolean;
  is_featured: boolean;
  title?: string;
  description?: string;
  slug?: string;
  tags: string[];
  view_count: number;
  sale_count: number;
  avg_rating: number;
  review_count: number;
  shipping_available: boolean;
  shipping_cost: number;
  pickup_only: boolean;
  compatibility_override?: Record<string, any>;
  status: 'active' | 'paused' | 'sold_out' | 'draft';
  published_at?: string;
  created_at: string;
  updated_at: string;

  // Joined fields from inventory product
  product_name: string;
  product_sku?: string;
  product_brand?: string;
  product_part_number?: string;
  product_image_url?: string;
  current_stock: number;
  universal: boolean;
  compatible_brands?: string[];
  compatible_models?: string[];
  compatible_years?: Record<string, any>;

  // Joined fields from workshop tenant
  workshop_name: string;
  workshop_address?: string;
  workshop_city?: string;
  workshop_phone?: string;
}

export interface CartItem {
  id: number;
  listing_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  title: string;
  brand?: string;
  image_url?: string;
  current_stock: number;
  tenant_id: number;
  workshop_name: string;
}

export interface ShoppingCart {
  id: number;
  client_id: number;
  status: string;
  total_items: number;
  subtotal_price: number;
  shipping_total: number;
  total_price: number;
  items: CartItem[];
}

export interface OrderItem {
  id: number;
  listing_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
  product_sku?: string;
  product_brand?: string;
}

export interface MarketplaceOrder {
  id: number;
  order_number: string;
  client_id: number;
  tenant_id: number;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  platform_commission: number;
  status: 'pending_payment' | 'paid' | 'confirmed' | 'preparing' | 'ready_pickup' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
  stripe_payment_intent_id?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  paid_at?: string;
  delivery_type: 'pickup' | 'shipping';
  delivery_address?: string;
  delivery_notes?: string;
  confirmed_at?: string;
  ready_at?: string;
  delivered_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  
  // Joined details
  workshop_name: string;
  workshop_phone?: string;
  client_name: string;
  items: OrderItem[];
}

export interface Promotion {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  applies_to: 'all' | 'category' | 'product' | 'listing';
  target_ids: number[];
  starts_at: string;
  ends_at: string;
  max_uses?: number;
  current_uses: number;
  min_purchase: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductReview {
  id: number;
  listing_id: number;
  client_id: number;
  order_id: number;
  tenant_id: number;
  rating: number;
  title?: string;
  comment?: string;
  is_verified: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  client_name: string;
}
