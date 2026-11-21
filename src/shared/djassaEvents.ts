export const DJASSA_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  DRIVER_ASSIGNED: 'delivery.driver_assigned',
  DELIVERY_STATUS_CHANGED: 'delivery.status_changed',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  REFUND_CREATED: 'refund.created',
  STOCK_CHANGED: 'stock.changed',
  MESSAGE_CREATED: 'message.created',
  NOTIFICATION_CREATED: 'notification.created',
  PARTNERSHIP_CHANGED: 'partnership.changed',
  INCIDENT_CREATED: 'incident.created',
  REVIEW_CREATED: 'review.created',
} as const;
