import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState, ensureProfileMonth, loadState, notesForMonth, resetProductionToZero, semesterProduction } from "../src/store.js";
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

test("anotações são isoladas por mês e registros antigos recebem competência", () => {
  const state = createDefaultState("2026-08");
  state.notes.consultor = [
    { id: "aug", monthKey: "2026-08", name: "Ana" },
    { id: "sep", monthKey: "2026-09", name: "Bia" },
  ];
  assert.deepEqual(notesForMonth(state.notes.consultor, "2026-08").map((note) => note.id), ["aug"]);

  const storage = {
    getItem() { return JSON.stringify({ ...state, notes: { consultor: [{ id: "legacy", name: "Carlos" }], gerente: [] } }); },
    setItem() {},
  };
  const normalized = loadState(storage);
  assert.equal(normalized.notes.consultor[0].monthKey, "2026-08");
});

test("estado corrompido não preserva quantidades ou salário fora do intervalo seguro", () => {
  const state = createDefaultState("2026-08");
  state.profiles.gerente.months["2026-08"].production.ead.inscritos = Number.MAX_SAFE_INTEGER;
  state.profiles.gerente.months["2026-08"].salary = "9".repeat(400);
  const storage = {
    getItem() { return JSON.stringify(state); },
    setItem() {},
  };
  const normalized = loadState(storage);
  assert.equal(normalized.profiles.gerente.months["2026-08"].production.ead.inscritos, 0);
  assert.equal(normalized.profiles.gerente.months["2026-08"].salary, 0);
});
