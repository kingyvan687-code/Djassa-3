import { Order, Product } from '../../../types';

export type SellerOrderFilter =
  | 'all'
  | 'today'
  | 'paid'
  | 'cod_pending'
  | 'returned'
  | 'damaged';

export type SellerOrderMainTab = 'active' | 'incidents' | 'history';
export type IncidentFilter = 'all' | 'damaged' | 'returned' | 'cancelled';

export type PaymentMethodFilter = 'all' | 'wave' | 'orange_money' | 'cash_on_delivery';
export type OrderSortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface SellerOrderStats {
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  paidCount: number;
  codPendingCount: number;
  returnedCount: number;
}
