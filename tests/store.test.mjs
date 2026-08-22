import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState, ensureProfileMonth, resetProductionToZero, semesterProduction } from "../src/store.js";
import { productionTotals } from "../src/model.js";

test("cada mês mantém produção e meta financeira independentes", () => {
  const state = createDefaultState("2026-08");
  const august = ensureProfileMonth(state, "consultor", "2026-08").monthState;
  august.financialGoal = 30;
  august.production.ead.matfin = 10;
  const september = ensureProfileMonth(state, "consultor", "2026-09").monthState;
  assert.equal(september.financialGoal, 30);
  assert.equal(september.production.ead.matfin, 0);
  assert.equal(august.production.ead.matfin, 10);
});

test("Matrícula Acadêmica acumula dentro do semestre", () => {
  const state = createDefaultState("2026-08");
  const august = ensureProfileMonth(state, "consultor", "2026-08").monthState;
  resetProductionToZero(august);
  august.production.ead.matacad = 8;
  const september = ensureProfileMonth(state, "consultor", "2026-09").monthState;
  september.production.ead.matacad = 4;
  assert.equal(productionTotals(semesterProduction(state, "consultor", "2026-09")).matacad, 12);
});
