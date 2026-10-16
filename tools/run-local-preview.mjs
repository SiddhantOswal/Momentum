// Ordinary local preview: no mock business results or implicit cloud calls.
if (process.env.K_SERVICE) throw new Error('Local preview launcher cannot run in Cloud Run.');
const port = process.env.USTAAD_LOCAL_PREVIEW_PORT ?? '4173';
if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error('USTAAD_LOCAL_PREVIEW_PORT must be between 1024 and 65535.');
Object.assign(process.env, {
  PORT: port, USTAAD_ENABLE_DEMO_MODE: 'false', USTAAD_AUTHORIZATION_MODE: '',
  USTAAD_ENABLE_FIREBASE_AUTH: 'false', USTAAD_ENABLE_LIVE_MODEL_CALLS: 'false',
  USTAAD_ENABLE_RISK_PREDICTION: 'false', USTAAD_ENABLE_HISTORICAL_EVIDENCE: 'false',
  USTAAD_ENABLE_IMPACT_SUMMARY: 'false', USTAAD_ENABLE_BIGQUERY_WRITES: 'false',
  USTAAD_ENABLE_JOB_STORAGE: 'false', USTAAD_ENABLE_FEEDBACK_WRITES: 'false',
  USTAAD_ENABLE_FIRESTORE_GEMINI_CAP: 'false', USTAAD_ENABLE_APPROVED_PHOTO_CLASSIFICATION: 'false',
  USTAAD_PUBLIC_ORIGIN: 'http://localhost:' + port,
});
console.log('LOCAL PREVIEW: no mock results; cloud-dependent actions remain unavailable until run in an authorized cloud environment.');
await import('../index.mjs');
