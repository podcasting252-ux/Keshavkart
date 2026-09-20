export interface RetailWholesaleSettings {
  enableWholesale: boolean;
  wholesaleMinOrderQuantity: number;
  wholesaleDiscountPercent?: number;
  wholesaleTermsNote?: string;
}

export interface ShopInfo {
  id: string;
  name: string;
  tagline: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  contact?: string; // alias for phone / contact
  address: string;
  shopImage?: string; // shop image/logo URL or persistent path
  deliveryEnabled: boolean; // delivery enabled
  deliveryPricePerKm: number; // delivery price per km
  retailWholesaleSettings: RetailWholesaleSettings; // retail/wholesale settings
  upiId: string;
  currency: string;
  minOrder: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
  openingHours: string;
  qrVersion: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  displayOrder: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  stock: number;
  unit?: string;
}

export interface Product {
  id: string;
  name: string;
  nameHindi?: string;
  category: string;
  description: string;
  images: string[];
  image: string; // primary image
  variants?: ProductVariant[];
  unit: string;
  retailPrice: number; // retail price
  price: number; // for backward compatibility, same as retailPrice
  wholesalePrice: number; // wholesale price
  stock: number; // quantity in stock
  inStock: boolean; // boolean stock indicator
  barcode: string; // barcode
  badge?: string;
  isVeg: boolean;
  originalPrice?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: ProductVariant;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  deliveryType: 'delivery' | 'pickup';
  paymentMethod: 'cod' | 'upi' | 'pickup_pay';
  notes?: string;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  price: number; // frozen original price at order time
  originalPrice?: number;
  wholesalePrice?: number;
  isWholesale?: boolean;
  variantId?: string;
  variantName?: string;
  image?: string;
}

export interface Order {
  id: string; // order number (e.g. ORD-8921)
  orderNumber?: string; // alias for order number
  shopId: string;
  shopName: string;
  items: CartItem[]; // backward compatibility
  orderItems?: OrderItemSnapshot[]; // detailed frozen snapshots
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  deliveryCharge?: number; // alias
  discount: number;
  totalAmount: number;
  grandTotal?: number; // alias for totalAmount
  customer: CustomerDetails;
  pickupOrDelivery?: 'pickup' | 'delivery';
  deliveryAddress?: string;
  distanceKm?: number;
  status: 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'cancelled';
  orderStatus?: 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'cancelled'; // alias
  createdAt: string; // date/time
  estimatedDelivery?: string;
}

export type ViewMode = 'customer' | 'owner';
export type OwnerTab = 'qr_code' | 'settings' | 'products' | 'categories' | 'orders';
