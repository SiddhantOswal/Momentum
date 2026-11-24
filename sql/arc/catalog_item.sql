-- catalog_item.sql: one catalog item by exact code.
-- Params: item_code (STRING). Reads prepagent.items only. Customer ID is left out on purpose.
SELECT
  item_code, box_style, length_mm, width_mm, height_mm, ply, flute_profile,
  top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf, ink_colors, ink_coverage_pct
FROM prepagent.items
WHERE item_code = @item_code
LIMIT 1;
