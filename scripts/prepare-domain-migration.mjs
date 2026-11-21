import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dataDir = path.join(root, 'server', 'data');
const outputDir = path.join(root, 'migration-reports');
const sources = [
  { file: 'auth_users.json', domain: 'identity', targets: ['djassa_users', 'djassa_credentials', 'djassa_memberships'], sensitive: true },
  { file: 'client_state.json', domain: 'client_profiles', targets: ['djassa_user_profiles', 'djassa_notifications'], sensitive: false },
  { file: 'commerce_db.json', domain: 'catalog_and_orders', targets: ['djassa_stores', 'djassa_products', 'djassa_orders', 'djassa_order_items', 'djassa_stock_movements'], sensitive: false },
  { file: 'db.json', domain: 'legacy_mixed', targets: ['REQUIRES_MANUAL_CLASSIFICATION'], sensitive: true },
  { file: 'credits_billing.json', domain: 'credits_and_billing', targets: ['djassa_ai_credit_accounts', 'djassa_ai_credit_transactions', 'djassa_ai_credit_recharges'], sensitive: true },
  { file: 'privacy_db.json', domain: 'privacy', targets: ['djassa_audit_events'], sensitive: true },
  { file: 'fraud_db.json', domain: 'fraud', targets: ['djassa_audit_events'], sensitive: true },
  { file: 'maintenance_db.json', domain: 'maintenance', targets: ['REQUIRES_SCHEMA_REVIEW'], sensitive: false },
  { file: 'surveillance_db.json', domain: 'surveillance', targets: ['djassa_api_provider_telemetry'], sensitive: true },
  { file: 'security_db.json', domain: 'security', targets: ['djassa_audit_events'], sensitive: true },
  { file: 'backups_db.json', domain: 'backup_metadata', targets: ['REQUIRES_SCHEMA_REVIEW'], sensitive: true },
];
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function walk(value, pathName = '$', out = []) {
  if (Array.isArray(value)) {
    out.push({ path: pathName, type: 'array', count: value.length });
    value.forEach((v, i) => walk(v, `${pathName}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    out.push({ path: pathName, type: 'object', keys: Object.keys(value).length });
    for (const [k, v] of Object.entries(value)) walk(v, `${pathName}.${k}`, out);
  }
  return out;
}
function summarize(value) {
  const collections = [];
  const duplicates = [];
  const visit = (v, p = '$') => {
    if (Array.isArray(v)) {
      const seen = new Map();
      let objects = 0;
      for (const item of v) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          objects++;
          const key = item.id ?? item.userId ?? item.orderId ?? item.reference ?? item.email;
          if (key !== undefined) {
            const normalized = String(key).trim().toLowerCase();
            if (seen.has(normalized)) duplicates.push({ collection: p, keyType: item.id !== undefined ? 'id' : item.userId !== undefined ? 'userId' : item.orderId !== undefined ? 'orderId' : item.reference !== undefined ? 'reference' : 'email' });
            else seen.set(normalized, true);
          }
        }
      }
      collections.push({ path: p, entries: v.length, objectEntries: objects });
      v.forEach((x, i) => visit(x, `${p}[${i}]`));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) visit(x, `${p}.${k}`);
    }
  };
  visit(value);
  return { collections, duplicateKeyWarnings: duplicates.length, duplicateSamples: duplicates.slice(0, 20) };
}

const report = { generatedAt: new Date().toISOString(), mode: 'READ_ONLY_PREFLIGHT', sourceDirectory: path.relative(root, dataDir), files: [], blockers: [], warnings: [] };
if (!fs.existsSync(dataDir)) report.blockers.push('Dossier server/data absent : aucune donnée historique réelle n’est incluse dans cette archive.');
for (const source of sources) {
  const full = path.join(dataDir, source.file);
  if (!fs.existsSync(full)) {
    report.files.push({ ...source, status: 'MISSING' });
    continue;
  }
  const raw = fs.readFileSync(full);
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    const summary = summarize(parsed);
    const fileReport = { ...source, status: 'PARSED', sha256: sha(raw), bytes: raw.length, rootType: Array.isArray(parsed) ? 'array' : typeof parsed, ...summary };
    report.files.push(fileReport);
    if (summary.duplicateKeyWarnings) report.warnings.push(`${source.file}: ${summary.duplicateKeyWarnings} clés candidates dupliquées; revue humaine obligatoire.`);
    if (source.targets.some((t) => t.startsWith('REQUIRES_'))) report.blockers.push(`${source.file}: mapping métier incomplet (${source.targets.join(', ')}).`);
  } catch {
    report.files.push({ ...source, status: 'INVALID_JSON', sha256: sha(raw), bytes: raw.length });
    report.blockers.push(`${source.file}: JSON invalide; fichier non importable.`);
  }
}
const present = report.files.filter((f) => f.status === 'PARSED').length;
if (!present) report.blockers.push('Aucun fichier JSON source exploitable trouvé.');
report.summary = { expectedFiles: sources.length, presentAndParsed: present, missing: report.files.filter((f) => f.status === 'MISSING').length, invalid: report.files.filter((f) => f.status === 'INVALID_JSON').length, productionCutoverAllowed: false };
fs.mkdirSync(outputDir, { recursive: true });
const out = path.join(outputDir, 'lot-3e-preflight.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(`Préflight lecture seule terminé : ${present}/${sources.length} sources JSON présentes et valides.`);
console.log(`Rapport : ${path.relative(root, out)}`);
console.log('Aucune donnée métier ou table PostgreSQL n’a été modifiée.');
console.log(`Blocages : ${report.blockers.length} | Avertissements : ${report.warnings.length}`);
if (report.blockers.length) process.exitCode = 2;
