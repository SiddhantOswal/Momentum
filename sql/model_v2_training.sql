-- =====================================================================================
-- model_v2_training.sql -- BILLABLE BigQuery ML TRAINING. Creates ONLY prepagent.m2_* models.
-- =====================================================================================
-- It never replaces, drops or modifies prepagent.m_* or any table (CREATE MODEL without
-- OR REPLACE: a re-run fails instead of overwriting; drop the m2_* models first to re-run).
-- Switching the app to m2_* models is a separate D4 decision (config/model-acceptance.json).
--
-- COST WARNING (measured, not estimated):
--   A dry run reports ~1.5 MB processed per CREATE MODEL, but BigQuery ML bills boosted-tree
--   training by compute. The Oct 2026 training of the current m_* models (job
--   bqjob_r4cfdf43fbdc1dad1_000001a12c5223a4_1, 20 iterations, depth 6, global explain)
--   billed 7.4 GB to 49.7 GB PER MODEL, 96.1 GB for the five (~1,670 bytes billed per slot-ms).
--   A --maximum_bytes_billed of 200 MB will not reflect that. Run ONE model first
--   (section 1, m2_warp) as a cost probe, read its totalBytesBilled, then decide on the rest.
--
-- Run each statement on its own, for example:
--   CLOUDSDK_PYTHON=... bq --project_id=prepagent-hack --location=asia-south1 query \
--     --nouse_legacy_sql --maximum_bytes_billed=<approved cap> < one_statement.sql
--
-- Split: TIME split. Train on run_date < 2026-07-01 (4,710 lots); hold out
-- 2026-07-01..2026-09-30 (640 lots, all RH 75..98 = monsoon). DATA_SPLIT_METHOD = 'NO_SPLIT'
-- and the holdout is scored explicitly with ML.EVALUATE (section 3). Early stopping is off:
-- BQML rejects min_relative_progress without an eval split, so iterations are fixed at 60.
--
-- Features (TRANSFORM, so ML.PREDICT takes the same raw columns predict.sql already builds;
-- swapping m_* -> m2_* needs no new inputs):
--   raw: item spec (box_style, dims, ply, flute_profile, liner/flute gsm, liner_bf, ink_colors,
--        ink_coverage_pct), quantity, shift, paper_type, paper_supplier, conditions
--        (ambient_rh_pct, ambient_temp_c, paper_moisture_pct), machine levers (sf_speed_mpm,
--        roll_temp_c, gum_application, gum_viscosity_sec, pasting_pressure, drying_hours,
--        print_speed_spm), sheet_area_m2, box_weight_kg.
--   dropped vs current m_*: customer_id (label-encoded customer is not a physical driver and
--        does not generalise to new customers).
--   F1 rh_band              ambient RH band: <=50, 50-70, 70-85, >85
--   F2 rh_x_paper_moisture  ambient_rh_pct * paper_moisture_pct (moisture pickup)
--   F3 dew_point_c          Magnus dew point from ambient RH and temperature
--   F4 recycled_paper_flag  1 if paper_type = 'RECYCLED'
--   F5 board_gsm_per_m2     box_weight_kg * 1000 / sheet_area_m2 (board basis weight)
--   F6 gum_visc_x_roll_temp gum_viscosity_sec * roll_temp_c (bond-line cure)
--   Considered, not used: month_of_year / monsoon flag. predict.sql does not send a run date,
--   and in lots the monthly scrap means move with RH (Jun-Sep high RH, high warp/delam), so
--   RH and dew point carry the seasonal signal without a calendar dependency.
--
-- Configurations (max two per defect; keep the better on the holdout):
--   A  m2_<defect>   depth 4, learn_rate 0.1, 60 iterations, subsample 0.8, colsample 0.8,
--                    l2 5, min_tree_child_weight 20
--   B  m2_<defect>_b depth 3, learn_rate 0.1, 60 iterations, subsample 0.7, colsample 0.7,
--                    l2 10, min_tree_child_weight 40 (shallower, more regularised)
--   If B wins for a defect:  bq cp -f prepagent.m2_<defect>_b prepagent.m2_<defect>
--   then remove the loser:   bq rm -f -m prepagent.m2_<defect>_b
--   (both commands touch m2_* models only). enable_global_explain is off to save compute;
--   drivers come from ML.FEATURE_IMPORTANCE (section 4).
-- =====================================================================================

-- Run record, 20 Nov 2026: Om approved configuration A only. Section 1 was run for all five
-- defects (85.3 GB billed in total: m2_warp 31.7 GB, the other four 13.3-13.5 GB each).
-- Section 2 (configuration B) was NOT run. Sections 3-5 were run with the candidate_B /
-- m2_*_b parts removed. Results: docs/evidence/model-candidates-v2.json.

-- ---------- 1. Configuration A (start with m2_warp alone as the cost probe) ----------
CREATE MODEL `prepagent-hack.prepagent.m2_warp`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_warp_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_warp_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 4, subsample = 0.8,
  colsample_bytree = 0.8, l1_reg = 0, l2_reg = 5, min_tree_child_weight = 20
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_delam`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_delam_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_delam_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 4, subsample = 0.8,
  colsample_bytree = 0.8, l1_reg = 0, l2_reg = 5, min_tree_child_weight = 20
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_strength`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_strength_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_strength_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 4, subsample = 0.8,
  colsample_bytree = 0.8, l1_reg = 0, l2_reg = 5, min_tree_child_weight = 20
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_print`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_print_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_print_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 4, subsample = 0.8,
  colsample_bytree = 0.8, l1_reg = 0, l2_reg = 5, min_tree_child_weight = 20
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_crack`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_crack_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_crack_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 4, subsample = 0.8,
  colsample_bytree = 0.8, l1_reg = 0, l2_reg = 5, min_tree_child_weight = 20
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';

-- ---------- 2. Configuration B ----------
CREATE MODEL `prepagent-hack.prepagent.m2_warp_b`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_warp_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_warp_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 3, subsample = 0.7,
  colsample_bytree = 0.7, l1_reg = 0, l2_reg = 10, min_tree_child_weight = 40
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_delam_b`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_delam_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_delam_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 3, subsample = 0.7,
  colsample_bytree = 0.7, l1_reg = 0, l2_reg = 10, min_tree_child_weight = 40
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_strength_b`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_strength_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_strength_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 3, subsample = 0.7,
  colsample_bytree = 0.7, l1_reg = 0, l2_reg = 10, min_tree_child_weight = 40
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_print_b`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_print_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_print_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 3, subsample = 0.7,
  colsample_bytree = 0.7, l1_reg = 0, l2_reg = 10, min_tree_child_weight = 40
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';
CREATE MODEL `prepagent-hack.prepagent.m2_crack_b`
TRANSFORM (
  -- raw columns (same names predict.sql already sends; customer_id deliberately not used)
  box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, paper_type, paper_supplier,
  ink_colors, ink_coverage_pct, quantity, shift,
  ambient_rh_pct, ambient_temp_c, paper_moisture_pct, sf_speed_mpm, roll_temp_c,
  gum_application, gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm,
  sheet_area_m2, box_weight_kg,
  -- engineered features (F1..F6, see header)
  CASE WHEN ambient_rh_pct <= 50 THEN 'RH_LE50' WHEN ambient_rh_pct <= 70 THEN 'RH_50_70'
       WHEN ambient_rh_pct <= 85 THEN 'RH_70_85' ELSE 'RH_GT85' END AS rh_band,
  ambient_rh_pct * paper_moisture_pct AS rh_x_paper_moisture,
  243.04 * (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))
    / (17.625 - (LN(ambient_rh_pct / 100) + 17.625 * ambient_temp_c / (243.04 + ambient_temp_c))) AS dew_point_c,
  IF(paper_type = 'RECYCLED', 1, 0) AS recycled_paper_flag,
  SAFE_DIVIDE(box_weight_kg * 1000, sheet_area_m2) AS board_gsm_per_m2,
  gum_viscosity_sec * roll_temp_c AS gum_visc_x_roll_temp,
  rate_crack_pct
)
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR', input_label_cols = ['rate_crack_pct'],
  data_split_method = 'NO_SPLIT', category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = FALSE, early_stop = FALSE,
  learn_rate = 0.1, max_iterations = 60, max_tree_depth = 3, subsample = 0.7,
  colsample_bytree = 0.7, l1_reg = 0, l2_reg = 10, min_tree_child_weight = 40
) AS
SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date < DATE '2026-07-01';

-- ---------- 3. Holdout comparison (read-only; current m_* vs candidates, same 640 rows) ----------
-- Note: current m_* were trained on run_date < 2026-09-01 with a RANDOM 80/20 split, so about
-- 80% of Jul-Aug 2026 holdout rows were in their training data; September 2026 is clean for both.
SELECT 'warp' AS defect, 'current' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_warp`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'warp' AS defect, 'candidate_A' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_warp`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'warp' AS defect, 'candidate_B' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_warp_b`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'delam' AS defect, 'current' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_delam`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'delam' AS defect, 'candidate_A' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_delam`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'delam' AS defect, 'candidate_B' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_delam_b`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'strength' AS defect, 'current' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_strength`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'strength' AS defect, 'candidate_A' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_strength`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'strength' AS defect, 'candidate_B' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_strength_b`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'print' AS defect, 'current' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_print`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'print' AS defect, 'candidate_A' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_print`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'print' AS defect, 'candidate_B' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_print_b`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'crack' AS defect, 'current' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_crack`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'crack' AS defect, 'candidate_A' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_crack`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
UNION ALL
SELECT 'crack' AS defect, 'candidate_B' AS model, e.r2_score, e.mean_absolute_error
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m2_crack_b`, (SELECT * FROM `prepagent-hack.prepagent.lots` WHERE run_date BETWEEN DATE '2026-07-01' AND DATE '2026-09-30')) e
ORDER BY defect, model;

-- ---------- 4. Top drivers (read-only; run after the winner is copied to m2_<defect>) ----------
SELECT * FROM (
SELECT 'm2_warp' AS model_name, feature, importance_gain FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m2_warp`)
UNION ALL
SELECT 'm2_delam' AS model_name, feature, importance_gain FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m2_delam`)
UNION ALL
SELECT 'm2_strength' AS model_name, feature, importance_gain FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m2_strength`)
UNION ALL
SELECT 'm2_print' AS model_name, feature, importance_gain FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m2_print`)
UNION ALL
SELECT 'm2_crack' AS model_name, feature, importance_gain FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m2_crack`)
)
QUALIFY ROW_NUMBER() OVER (PARTITION BY model_name ORDER BY importance_gain DESC) <= 5
ORDER BY model_name, importance_gain DESC;

-- ---------- 5. Humidity sweep of the candidates (read-only, one query) ----------
-- Same PO1 inputs as tools/humidity-sweep.mjs (item PKBX0041 x 1300, RECYCLED / SUP-D, DAY,
-- 26 C, paper moisture 10.8 %, SF 48 m/min, roll 162 C, gum HIGH 32 s, pasting MED, drying 5 h,
-- print 60 spm), RH 40 -> 95 step 5. Inputs are built exactly as in sql/predict.sql.
WITH spec AS (
  SELECT *,
    CASE
      WHEN box_style = 'TRAY' THEN (length_mm + 2*height_mm + 20) * (width_mm + 2*height_mm + 20) / 1e6
      WHEN box_style = 'DIECUT' AND height_mm = 0 THEN length_mm * width_mm * 1.1 / 1e6
      WHEN box_style = 'DIECUT' THEN (2*length_mm + 2*width_mm + 35) * (width_mm + height_mm) / 1e6 * 1.15
      ELSE (2*length_mm + 2*width_mm + 35) * (width_mm + height_mm) / 1e6
    END AS area,
    top_liner_gsm + inner_liner_gsm
      + flute_gsm * CASE flute_profile WHEN 'BC' THEN 1 WHEN 'BCB' THEN 2 ELSE 0 END
      + flute_gsm * CASE flute_profile WHEN 'B' THEN 1.32 WHEN 'C' THEN 1.43 WHEN 'E' THEN 1.27
                                      WHEN 'BC' THEN 2.75 WHEN 'BCB' THEN 4.07 ELSE 1.4 END AS board_gsm
  FROM `prepagent-hack.prepagent.items`
  WHERE item_code = 'PKBX0041'
),
input AS (
  SELECT
    FORMAT('RH_%d', v) AS rh_scenario,
    customer_id, box_style, length_mm, width_mm, height_mm, ply, flute_profile,
    top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf,
    'RECYCLED' AS paper_type, 'SUP-D' AS paper_supplier,
    ink_colors, ink_coverage_pct, 1300 AS quantity, 'DAY' AS shift,
    CAST(v AS FLOAT64) AS ambient_rh_pct, 26.0 AS ambient_temp_c, 10.8 AS paper_moisture_pct,
    48.0 AS sf_speed_mpm, 162.0 AS roll_temp_c, 'HIGH' AS gum_application, 32.0 AS gum_viscosity_sec,
    'MED' AS pasting_pressure, 5.0 AS drying_hours, 60.0 AS print_speed_spm,
    area AS sheet_area_m2, area * board_gsm / 1000 AS box_weight_kg
  FROM spec CROSS JOIN UNNEST(GENERATE_ARRAY(40, 95, 5)) AS v
),
w  AS (SELECT rh_scenario, predicted_rate_warp_pct     AS v FROM ML.PREDICT(MODEL `prepagent-hack.prepagent.m2_warp`,     (SELECT * FROM input))),
d  AS (SELECT rh_scenario, predicted_rate_delam_pct    AS v FROM ML.PREDICT(MODEL `prepagent-hack.prepagent.m2_delam`,    (SELECT * FROM input))),
st AS (SELECT rh_scenario, predicted_rate_strength_pct AS v FROM ML.PREDICT(MODEL `prepagent-hack.prepagent.m2_strength`, (SELECT * FROM input))),
p  AS (SELECT rh_scenario, predicted_rate_print_pct    AS v FROM ML.PREDICT(MODEL `prepagent-hack.prepagent.m2_print`,    (SELECT * FROM input))),
c  AS (SELECT rh_scenario, predicted_rate_crack_pct    AS v FROM ML.PREDICT(MODEL `prepagent-hack.prepagent.m2_crack`,    (SELECT * FROM input)))
SELECT
  i.ambient_rh_pct AS rh_pct,
  ROUND(GREATEST(w.v, 0), 4) AS rate_warp,
  ROUND(GREATEST(d.v, 0), 4) AS rate_delam,
  ROUND(GREATEST(st.v, 0), 4) AS rate_strength,
  ROUND(IF(i.ink_colors = 0, 0, GREATEST(p.v, 0)), 4) AS rate_print,
  ROUND(GREATEST(c.v, 0), 4) AS rate_crack
FROM input i
JOIN w USING (rh_scenario) JOIN d USING (rh_scenario) JOIN st USING (rh_scenario)
JOIN p USING (rh_scenario) JOIN c USING (rh_scenario)
ORDER BY rh_pct;
-- Feed the rows to analyzeSweep() in tools/humidity-sweep.mjs for the largest adjacent jump
-- per defect (abrupt if > 1.0 pp per 5 %RH step) and compare with docs/evidence/humidity-sweep.json.
