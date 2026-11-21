import { query, withTransaction } from '../database';
import { deterministicDomainUuid, isPgReady } from './commercePgRepository';

export async function recordPgPaymentWebhookEvent(input: {
  provider: string;
  providerEventKey: string;
  providerReference: string | null;
  eventType: string;
  signatureValid: boolean;
  processingStatus: 'received' | 'processing' | 'processed' | 'ignored' | 'failed';
  payloadRedacted: Record<string, unknown>;
  failureReason?: string;
}): Promise<{ inserted: boolean }> {
  if (!(await isPgReady())) return { inserted: true };
  const rows = await query<{ id: string }>(
    `INSERT INTO djassa_payment_webhook_events(
       provider, provider_event_key, provider_reference, event_type,
       signature_valid, processing_status, payload_redacted, failure_reason, processed_at
     )
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,CASE WHEN $6 IN ('processed','ignored','failed') THEN now() ELSE NULL END)
     ON CONFLICT (provider, provider_event_key) DO NOTHING
     RETURNING id::text`,
    [
      input.provider,
      input.providerEventKey,
      input.providerReference,
      input.eventType,
      input.signatureValid,
      input.processingStatus,
      JSON.stringify(input.payloadRedacted),
      input.failureReason || null
    ]
  );
  return { inserted: rows.length > 0 };
}

export async function syncPgPaymentStatusUpdate(input: {
  paymentId: string;
  orderId: string;
  provider: string;
  providerReference: string | null;
  previousStatus: string | null;
  nextStatus: string;
  source: 'api' | 'webhook' | 'reconciliation' | 'admin';
  providerStatus?: string;
  eventKey: string;
  amountFcfa: number;
  payerPhoneMasked?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const paymentUuid = deterministicDomainUuid(`payment:${input.paymentId}`);
  const orderUuid = deterministicDomainUuid(`order:${input.orderId}`);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE djassa_payments
          SET status = $2,
              provider_reference = COALESCE($3, provider_reference),
              provider_status = COALESCE($4, provider_status),
              payer_phone_masked = COALESCE($5, payer_phone_masked),
              verified_webhook_at = CASE WHEN $6 = 'webhook' AND $2 = 'confirmed' THEN now() ELSE verified_webhook_at END,
              confirmed_at = CASE WHEN $2 = 'confirmed' THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END
        WHERE id = $1::uuid`,
      [paymentUuid, input.nextStatus, input.providerReference, input.providerStatus || null, input.payerPhoneMasked || null, input.source]
    );
    await client.query(
      `INSERT INTO djassa_payment_status_events(
         payment_id, previous_status, next_status, source, provider_status, event_key, details
       )
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (event_key) DO NOTHING`,
      [
        paymentUuid,
        input.previousStatus,
        input.nextStatus,
        input.source,
        input.providerStatus || null,
        input.eventKey,
        JSON.stringify({ orderId: orderUuid, amountFcfa: input.amountFcfa })
      ]
    );
  });
}

export async function recordPgWalletLedgerEntry(input: {
  accountId: string;
  transactionKey: string;
  entryType: 'credit' | 'debit' | 'hold' | 'release' | 'fee' | 'refund' | 'adjustment';
  amountFcfa: number;
  status?: 'pending' | 'posted' | 'reversed' | 'rejected';
  referenceType?: string;
  referenceId?: string;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!(await isPgReady()) || input.amountFcfa <= 0) return;
  const ownerUuid = deterministicDomainUuid(`user:${input.accountId}`);
  const refUuid = input.referenceId ? deterministicDomainUuid(input.referenceId) : null;
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO djassa_users(id, email, display_name, status) VALUES($1::uuid, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
      [ownerUuid, `${input.accountId}@djassa.internal`, input.accountId]
    );
    const walletRes = await client.query<{ id: string }>(
      `INSERT INTO djassa_wallets(owner_user_id, currency) VALUES($1::uuid, 'XOF')
       ON CONFLICT (owner_user_id, currency) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
       RETURNING id::text`,
      [ownerUuid]
    );
    const walletId = walletRes.rows[0].id;
    await client.query(
      `INSERT INTO djassa_wallet_ledger(
         wallet_id, transaction_key, entry_type, amount_fcfa, status,
         reference_type, reference_id, description, idempotency_key, source_system, metadata, posted_at
       )
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7::uuid,$8,$9,'djassa',$10::jsonb,now())
       ON CONFLICT (transaction_key) DO NOTHING`,
      [
        walletId,
        input.transactionKey,
        input.entryType,
        Math.round(input.amountFcfa),
        input.status || 'posted',
        input.referenceType || null,
        refUuid,
        input.description || null,
        input.idempotencyKey || input.transactionKey,
        JSON.stringify(input.metadata || {})
      ]
    );
  });
}

export async function recordPgCommissionEntry(input: {
  orderId: string;
  beneficiaryId: string;
  beneficiaryRole: 'seller' | 'platform';
  commissionType: string;
  basisAmountFcfa: number;
  commissionAmountFcfa: number;
  status: 'pending' | 'accrued' | 'reversed' | 'cancelled';
  ledgerTransactionKey: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  const orderUuid = deterministicDomainUuid(`order:${input.orderId}`);
  const userUuid = deterministicDomainUuid(`user:${input.beneficiaryId}`);
  await query(
    `INSERT INTO djassa_commission_entries(
       order_id, beneficiary_user_id, beneficiary_role, commission_type,
       basis_amount_fcfa, commission_amount_fcfa, status, ledger_transaction_key, accrued_at, reversed_at
     )
     VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,CASE WHEN $7='accrued' THEN now() ELSE NULL END, CASE WHEN $7='reversed' THEN now() ELSE NULL END)
     ON CONFLICT (ledger_transaction_key) DO UPDATE SET
       status = EXCLUDED.status,
       reversed_at = CASE WHEN EXCLUDED.status = 'reversed' THEN COALESCE(djassa_commission_entries.reversed_at, now()) ELSE djassa_commission_entries.reversed_at END`,
    [
      orderUuid,
      userUuid,
      input.beneficiaryRole,
      input.commissionType,
      Math.round(input.basisAmountFcfa),
      Math.round(input.commissionAmountFcfa),
      input.status,
      input.ledgerTransactionKey
    ]
  );
}

export async function recordPgFinancialReconciliationRun(input: {
  scope: 'payments' | 'wallets' | 'commissions' | 'payouts' | 'all';
  status: 'matched' | 'mismatch' | 'failed';
  sourceTotals: Record<string, unknown>;
  ledgerTotals: Record<string, unknown>;
  mismatchCount: number;
  findings: unknown[];
}): Promise<void> {
  if (!(await isPgReady())) return;
  await query(
    `INSERT INTO djassa_financial_reconciliation_runs(
       scope, status, source_totals, ledger_totals, mismatch_count, findings, completed_at
     )
     VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,now())`,
    [
      input.scope,
      input.status,
      JSON.stringify(input.sourceTotals),
      JSON.stringify(input.ledgerTotals),
      input.mismatchCount,
      JSON.stringify(input.findings)
    ]
  );
}

export async function syncPgAiCreditAccount(input: {
  userId: string;
  balanceCredits: number;
  lastDailyBonusAt?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  await query(
    `INSERT INTO djassa_ai_credit_accounts(user_id, balance_credits, last_daily_bonus_at, updated_at)
     VALUES($1, GREATEST(0, $2::integer), $3::timestamptz, now())
     ON CONFLICT (user_id) DO UPDATE SET
       balance_credits = GREATEST(0, EXCLUDED.balance_credits),
       last_daily_bonus_at = COALESCE(EXCLUDED.last_daily_bonus_at, djassa_ai_credit_accounts.last_daily_bonus_at),
       updated_at = now()`,
    [input.userId, Math.max(0, Math.floor(input.balanceCredits)), input.lastDailyBonusAt || null]
  );
}

export async function recordPgAiCreditTransaction(input: {
  id: string;
  userId: string;
  txType: 'recharge' | 'deduct' | 'refund' | 'bonus';
  creditsDelta: number;
  amountFcfa: number;
  status: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!(await isPgReady())) return;
  await query(
    `INSERT INTO djassa_ai_credit_transactions(
       id, user_id, tx_type, credits_delta, amount_fcfa, status, idempotency_key, metadata
     )
     VALUES($1,$2,$3,$4::integer,$5::bigint,$6,$7,$8::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.id,
      input.userId,
      input.txType,
      Math.trunc(input.creditsDelta),
      Math.round(input.amountFcfa || 0),
      input.status,
      input.idempotencyKey || null,
      JSON.stringify(input.metadata || {})
    ]
  );
}

export async function syncPgAiCreditRecharge(input: {
  id: string;
  userId: string;
  amountFcfa: number;
  credits: number;
  paymentMethod: string;
  phoneNumber?: string;
  paymentFeeFcfa: number;
  netRevenueFcfa: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'failed';
  providerReference?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}): Promise<void> {
  if (!(await isPgReady())) return;
  await query(
    `INSERT INTO djassa_ai_credit_recharges(
       id, user_id, amount_fcfa, credits, payment_method, phone_number,
       payment_fee_fcfa, net_revenue_fcfa, status, provider_reference, verified_by, verified_at
     )
     VALUES($1,$2,$3::bigint,$4::integer,$5,$6,$7::bigint,$8::bigint,$9,$10,$11,$12::timestamptz)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       provider_reference = COALESCE(EXCLUDED.provider_reference, djassa_ai_credit_recharges.provider_reference),
       verified_by = COALESCE(EXCLUDED.verified_by, djassa_ai_credit_recharges.verified_by),
       verified_at = COALESCE(EXCLUDED.verified_at, djassa_ai_credit_recharges.verified_at)`,
    [
      input.id,
      input.userId,
      Math.max(1, Math.round(input.amountFcfa)),
      Math.max(1, Math.floor(input.credits)),
      input.paymentMethod,
      input.phoneNumber || null,
      Math.max(0, Math.round(input.paymentFeeFcfa)),
      Math.round(input.netRevenueFcfa),
      input.status,
      input.providerReference || null,
      input.verifiedBy || null,
      input.verifiedAt || null
    ]
  );
}

export async function upsertPgSellerPayoutAccount(input: {
  sellerId: string;
  preferredChannel: 'wave' | 'orange_money';
  wavePhone?: string | null;
  orangeMoneyPhone?: string | null;
  accountHolderName?: string | null;
}): Promise<void> {
  if (!(await isPgReady())) return;
  await query(
    `INSERT INTO djassa_seller_payout_accounts(
       seller_id, preferred_channel, wave_phone, orange_money_phone, account_holder_name, updated_at
     )
     VALUES($1,$2,$3,$4,$5,now())
     ON CONFLICT (seller_id) DO UPDATE SET
       preferred_channel = EXCLUDED.preferred_channel,
       wave_phone = EXCLUDED.wave_phone,
       orange_money_phone = EXCLUDED.orange_money_phone,
       account_holder_name = EXCLUDED.account_holder_name,
       updated_at = now()`,
    [
      input.sellerId,
      input.preferredChannel,
      input.wavePhone || null,
      input.orangeMoneyPhone || null,
      input.accountHolderName || null
    ]
  );
}

export async function getPgSellerPayoutAccount(sellerId: string) {
  if (!(await isPgReady())) return null;
  const rows = await query<{
    seller_id: string;
    preferred_channel: 'wave' | 'orange_money';
    wave_phone: string | null;
    orange_money_phone: string | null;
    account_holder_name: string | null;
    verified: boolean;
    updated_at: string;
  }>(
    `SELECT seller_id, preferred_channel, wave_phone, orange_money_phone, account_holder_name, verified, updated_at
       FROM djassa_seller_payout_accounts WHERE seller_id = $1`,
    [sellerId]
  );
  return rows[0] || null;
}

export async function recordPgCommissionSettlement(input: {
  id: string;
  orderId: string;
  sellerId: string;
  amountFcfa: number;
  channel: string;
  providerReference?: string | null;
  status: string;
  settledBy?: string | null;
  notes?: string | null;
}): Promise<void> {
  if (!(await isPgReady())) return;
  await query(
    `INSERT INTO djassa_commission_settlements(
       id, order_id, seller_id, amount_fcfa, channel, provider_reference, status, settled_by, notes
     )
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.id,
      input.orderId,
      input.sellerId,
      Math.max(0, Math.round(input.amountFcfa)),
      input.channel,
      input.providerReference || null,
      input.status,
      input.settledBy || null,
      input.notes || null
    ]
  );
}
