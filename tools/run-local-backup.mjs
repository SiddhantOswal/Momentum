// Explicit local-only launcher; never imported by the Cloud Run entry point.
if (process.env.K_SERVICE) throw new Error('Local synthetic backup cannot run in Cloud Run.');
const port = process.env.USTAAD_LOCAL_DEMO_PORT ?? '4173';
if (!/^\d{4,5}$/.test(port) || Number(port)<1024 || Number(port)>65535) throw new Error('USTAAD_LOCAL_DEMO_PORT must be an integer from1024 to65535.');
Object.assign(process.env, {
  PORT:port, USTAAD_ENABLE_DEMO_MODE:'true', USTAAD_AUTHORIZATION_MODE:'',
  USTAAD_PLANT_ID:'PLANT-DEMO-01', USTAAD_ENABLE_FIREBASE_AUTH:'false',
  USTAAD_ENABLE_LIVE_MODEL_CALLS:'false', USTAAD_ENABLE_RISK_PREDICTION:'false',
  USTAAD_ENABLE_HISTORICAL_EVIDENCE:'false', USTAAD_ENABLE_IMPACT_SUMMARY:'false',
  USTAAD_ENABLE_BIGQUERY_WRITES:'false', USTAAD_ENABLE_JOB_STORAGE:'false',
  USTAAD_ENABLE_FEEDBACK_WRITES:'false', USTAAD_ENABLE_FIRESTORE_GEMINI_CAP:'false',
  USTAAD_ENABLE_APPROVED_PHOTO_CLASSIFICATION:'false',
  USTAAD_PUBLIC_ORIGIN:'http://127.0.0.1:'+port,
});
console.log('LOCAL SYNTHETIC BACKUP: mock outputs, process-memory records, no cloud model or business writes.');
await import('../index.mjs');
