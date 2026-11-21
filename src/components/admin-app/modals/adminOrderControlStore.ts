import { OrderStatus } from '../../../types';

export type DetailedLogisticsStage =
  | 'passed'
  | 'payment_confirmed'
  | 'preparing'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type FundsEscrowStatus =
  | 'En attente'
  | 'Bloqués'
  | 'Disponibles'
  | 'Débloqués'
  | 'Remboursés';

export type IncidentCategory =
  | 'lost_package'
  | 'damaged_package'
  | 'major_delay'
  | 'delivery_refusal'
  | 'non_conforming'
  | 'delivery_failed';

export type IncidentProcessingStatus =
  | 'Ouvert'
  | 'En instruction'
  | 'Résolu'
  | 'Rejeté';

export type RefundProcessingStatus =
  | 'Aucun'
  | 'Demandé'
  | 'En cours'
  | 'Effectué'
  | 'Échoué';

export interface OrderIncidentRecord {
  id: string;
  category: IncidentCategory;
  typeLabel: string;
  reporter: string;
  dateTime: string;
  reason: string;
  description: string;
  photoUrls: string[];
  responsibleParty: 'Vendeur' | 'Client' | 'À déterminer';
  status: IncidentProcessingStatus;
  adminDecision?: string;
  compensationAmount?: number;
  updatedAt?: string;
}

export interface OrderReturnInfo {
  hasReturn: boolean;
  returnStatus: 'Demandé' | 'En cours de retour' | 'Reçu par le vendeur' | 'Clôturé';
  reason: string;
  pickupDate: string;
  packageCondition: string;
  sellerReceivedAt?: string;
}

export interface OrderRefundRecord {
  requestedAmount: number;
  refundableAmount: number;
  refundedAmount: number;
  reason: string;
  method: 'Wave' | 'Orange Money' | 'Avoir Djassa';
  reference: string;
  dateTime: string;
  status: RefundProcessingStatus;
  returnInfo?: OrderReturnInfo;
}

export interface AdminPrivateNote {
  id: string;
  adminName: string;
  category: 'Général' | 'Finances' | 'Litige' | 'Vigilance';
  content: string;
  dateTime: string;
  isPrivate: true;
}

export interface AdminInterventionRecord {
  id: string;
  adminName: string;
  dateTime: string;
  actionType: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface OrderControlOverride {
  stage?: DetailedLogisticsStage;
  fundsStatus?: FundsEscrowStatus;
  cancelledInfo?: {
    by: string;
    at: string;
    reason: string;
  };
  incidents?: OrderIncidentRecord[];
  refund?: OrderRefundRecord;
  privateNotes?: AdminPrivateNote[];
  interventions?: AdminInterventionRecord[];
}

const STORAGE_KEY = 'djassa_admin_order_controls_v1';

export const STAGE_LABELS: Record<DetailedLogisticsStage, string> = {
  passed: 'Commande confirmée',
  payment_confirmed: 'Commande confirmée',
  preparing: 'Commande confirmée',
  delivered: 'Commande confirmée',
  cancelled: 'Commande annulée',
  returned: 'Colis retourné'
};

export const mapDetailedStageToOrderStatus = (stage: DetailedLogisticsStage): OrderStatus => {
  switch (stage) {
    case 'passed':
      return 'passed';
    case 'payment_confirmed':
      return 'payment_confirmed';
    case 'preparing':
      return 'preparing';
    case 'delivered':
      return 'delivered';
    case 'returned':
      return 'returned';
    case 'cancelled':
      return 'cancelled';
  }
};

export const loadAllOrderControls = (): Record<string, OrderControlOverride> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getOrderControl = (orderNumber: string): OrderControlOverride => {
  const all = loadAllOrderControls();
  return all[orderNumber] || {};
};

export const saveOrderControl = (
  orderNumber: string,
  nextControl: OrderControlOverride
): OrderControlOverride => {
  const all = loadAllOrderControls();
  all[orderNumber] = nextControl;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore quota issues
  }
  return nextControl;
};

export const formatNowFR = (): { date: string; time: string; dateTime: string } => {
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const time = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return { date, time, dateTime: `${date} à ${time}` };
};
