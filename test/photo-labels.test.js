import assert from "node:assert/strict";
import test from "node:test";
import { defectFromApprovedPhotoFolder, shouldQuerySeenBefore } from "../src/photo-labels.js";

test("approved photo folder labels map exactly to Om's defect classes", () => {
  assert.equal(defectFromApprovedPhotoFolder("crushed"), "STRENGTH");
  assert.equal(defectFromApprovedPhotoFolder("good"), "NONE");
  assert.equal(defectFromApprovedPhotoFolder("CRUSHED"), "STRENGTH");
  assert.deepEqual(
    Object.fromEntries(["crack", "delam", "print", "warp"].map((folder) => [
      folder, defectFromApprovedPhotoFolder(folder),
    ])),
    { crack: "CRACK", delam: "DELAM", print: "PRINT", warp: "WARP" },
  );
  assert.equal(defectFromApprovedPhotoFolder("other"), undefined);
  assert.equal(shouldQuerySeenBefore(defectFromApprovedPhotoFolder("good")), false);
  assert.equal(shouldQuerySeenBefore(defectFromApprovedPhotoFolder("crushed")), true);
});
