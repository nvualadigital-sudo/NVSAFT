import test from "node:test";
import assert from "node:assert/strict";
import { displayReference, patientDisplayReference } from "../artifacts/lab-results/src/utils/displayReference";

test("human references stay short without mutating canonical identifiers", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const label = displayReference(id);
  assert.equal(label, "123E4567…4000");
  assert.equal(id, "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(displayReference("ULTRA/001"), "ULTRA/001");
  assert.equal(displayReference("LAB/001"), "LAB/001");
  assert.equal(patientDisplayReference({ processo: "ULTRA/001", id }), "ULTRA/001");
  assert.equal(patientDisplayReference({ id: 42 }), "#42");
});
