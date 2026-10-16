-- PROPOSED NEW EVALUATION ONLY; NOT EXECUTED OR APPROVED. No retraining.
-- Source etag: u3Gv8hf6VCK4J7f8MHFxFQ==; Vertex version: 1
SELECT * FROM ML.EVALUATE(
  MODEL `prepagent-hack.prepagent.m_strength`,
  (SELECT `customer_id`,
      `box_style`,
      `length_mm`,
      `width_mm`,
      `height_mm`,
      `ply`,
      `flute_profile`,
      `top_liner_gsm`,
      `flute_gsm`,
      `inner_liner_gsm`,
      `liner_bf`,
      `paper_type`,
      `paper_supplier`,
      `ink_colors`,
      `ink_coverage_pct`,
      `quantity`,
      `shift`,
      `ambient_rh_pct`,
      `ambient_temp_c`,
      `paper_moisture_pct`,
      `sf_speed_mpm`,
      `roll_temp_c`,
      `gum_application`,
      `gum_viscosity_sec`,
      `pasting_pressure`,
      `drying_hours`,
      `print_speed_spm`,
      `sheet_area_m2`,
      `box_weight_kg`,
      `rate_strength_pct`
   FROM `prepagent-hack.prepagent.lots` FOR SYSTEM_TIME AS OF @source_as_of
   WHERE run_date >= DATE '2026-09-01'
    AND run_date < DATE '2026-10-01'
    AND NOT STARTS_WITH(lot_id, 'TEST-'))
);
