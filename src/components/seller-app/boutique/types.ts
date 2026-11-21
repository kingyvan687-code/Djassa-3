export type BoutiqueTab = 'marchandises' | 'commandes' | 'revenus';

export type IssueType = 
  | 'client_claim' 
  | 'damaged_stock' 
  | 'delivery_issue' 
  | 'factory_defect' 
  | 'inventory_shortage'
  | 'order_cancellation'
  | 'order_return';

export type IssuePriority = 'low' | 'medium' | 'urgent';

export type IssueStatus = 'pending' | 'in_progress' | 'resolved' | 'refunded';

export type ResolutionAction = 
  | 'refunded' 
  | 'exchanged' 
  | 'restocked' 
  | 'djassa_guarantee_claimed' 
  | 'voucher_issued' 
  | 'closed';

export interface IssueActivityNote {
  id: string;
  author: string;
  date: string;
  content: string;
}

export interface BoutiqueIssue {
  id: string;
  type: IssueType;
  title: string;
  reference: string;
  description: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  orderId?: string;
  orderNumber?: string;
  clientName?: string;
  clientPhone?: string;
  clientAvatar?: string;
  clientCommune?: string;
  photoProof?: string;
  priority: IssuePriority;
  status: IssueStatus;
  financialImpact: number;
  createdAt: string;
  stockRemaining?: number;
  liability?: 'seller' | 'client';
  activityNotes?: IssueActivityNote[];
  djassaClaimStatus?: 'not_claimed' | 'claimed' | 'approved' | 'rejected';
  reintegratedStock?: boolean;
  resolutionNotes?: string;
  resolutionAction?: ResolutionAction;
  refundedAmount?: number;
  exchangedProductId?: string;
}

export interface SellerTransaction {
  id: string;
  type: 'sale_earning' | 'withdrawal' | 'refund_deduction';
  amount: number;
  grossAmount?: number;
  platformFee?: number;
  netAmount?: number;
  description: string;
  date: string;
  time?: string;
  status: 'completed' | 'pending' | 'failed';
  provider?: 'wave' | 'orange_money' | 'mtn_momo' | 'moov' | 'moov_money' | 'bank_transfer' | string;
  phone?: string;
  reference: string;
  orderNumber?: string;
  clientName?: string;
  bankName?: string;
  accountName?: string;
}
