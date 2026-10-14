const FOLDER_LABELS = Object.freeze({
  crack: "CRACK",
  crushed: "STRENGTH",
  delam: "DELAM",
  good: "NONE",
  print: "PRINT",
  warp: "WARP",
});
const QUERYABLE_DEFECTS = new Set(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);

export function defectFromApprovedPhotoFolder(folderName) {
  if (typeof folderName !== "string") return undefined;
  return FOLDER_LABELS[folderName.trim().toLowerCase()];
}

export function shouldQuerySeenBefore(defect) {
  return QUERYABLE_DEFECTS.has(defect);
}

export const APPROVED_PHOTO_FOLDER_LABELS = FOLDER_LABELS;
