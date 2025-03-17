export type Role = 'super_admin' | 'admin' | 'manager' | 'waiter';

export interface User {
  id: string;
  email: string;
  role: Role;
  restaurantId?: string;
  restaurant_id?: string;
  name: string;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  restaurantId: string;
  created_at: string;
  updated_at: string;
}

export interface Command {
  id: string;
  tableId: string;
  userId: string; // garçom responsável
  status: 'open' | 'closed' | 'paid';
  total: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  paid_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  restaurantId: string;
  created_at: string;
  updated_at: string;
}

export interface CommandProduct {
  id: string;
  commandId: string;
  productId: string;
  quantity: number;
  price: number; // preço no momento da compra
  notes?: string;
  created_at: string;
  updated_at: string;
} 