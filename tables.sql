-- Historical bootstrap schema, retained for provenance and contract reference.
-- Not a complete current-project provisioning script: review live schema and
-- approved migrations (including approval_audit) before any DDL. Do not apply
-- this file automatically when cloning or starting the application.

CREATE TABLE IF NOT EXISTS `prepagent-hack.prepagent.lots` (
  lot_id STRING,
  order_id STRING,
  customer_id STRING,
  box_style STRING,
  length_mm INT64,
  width_mm INT64,
  height_mm INT64,
  ply INT64,
  flute_profile STRING,
  top_liner_gsm INT64,
  flute_gsm INT64,
  inner_liner_gsm INT64,
  liner_bf INT64,
  paper_type STRING,
  paper_supplier STRING,
  ink_colors INT64,
  ink_coverage_pct FLOAT64,
  quantity INT64,
  run_date DATE,
  shift STRING,
  ambient_rh_pct FLOAT64,
  ambient_temp_c FLOAT64,
  paper_moisture_pct FLOAT64,
  sf_speed_mpm FLOAT64,
  roll_temp_c FLOAT64,
  gum_application STRING,
  gum_viscosity_sec FLOAT64,
  pasting_pressure STRING,
  drying_hours FLOAT64,
  print_speed_spm FLOAT64,
  sheet_area_m2 FLOAT64,
  box_weight_kg FLOAT64,
  rate_warp_pct FLOAT64,
  rate_delam_pct FLOAT64,
  rate_strength_pct FLOAT64,
  rate_print_pct FLOAT64,
  rate_crack_pct FLOAT64,
  total_scrap_kg FLOAT64,
  scrap_cost FLOAT64,
  currency STRING,
  primary_defect STRING
)
PARTITION BY run_date;

CREATE TABLE IF NOT EXISTS `prepagent-hack.prepagent.sensor_readings` (
  reading_id STRING,
  ts TIMESTAMP,
  plant_id STRING,
  ambient_rh_pct FLOAT64,
  ambient_temp_c FLOAT64,
  paper_moisture_pct FLOAT64,
  source STRING
)
PARTITION BY DATE(ts);

CREATE TABLE IF NOT EXISTS `prepagent-hack.prepagent.job_sheets` (
  job_id STRING,
  created_at TIMESTAMP,
  plant_id STRING,
  status STRING,
  order_json JSON,
  conditions_json JSON,
  baseline_json JSON,
  recommended_json JSON,
  changes_json JSON,
  evidence_json JSON,
  explanation_en STRING,
  savings_kg FLOAT64,
  savings_cost FLOAT64,
  currency STRING,
  approved_at TIMESTAMP,
  card_uri STRING
);

CREATE TABLE IF NOT EXISTS `prepagent-hack.prepagent.feedback` (
  job_id STRING,
  lot_id STRING,
  created_at TIMESTAMP,
  rate_warp_pct FLOAT64,
  rate_delam_pct FLOAT64,
  rate_strength_pct FLOAT64,
  rate_print_pct FLOAT64,
  rate_crack_pct FLOAT64,
  photo_uri STRING,
  photo_defect STRING,
  photo_confidence FLOAT64,
  override BOOL,
  operator_note STRING,
  operator_note_en STRING,
  note_lang STRING
);

CREATE TABLE IF NOT EXISTS `prepagent-hack.prepagent.plants` (
  plant_id STRING,
  name STRING,
  base_currency STRING,
  cost_per_kg FLOAT64,
  default_locale STRING
);
