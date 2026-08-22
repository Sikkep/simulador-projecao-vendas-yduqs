import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMonth,
  conversion,
  conversionLabel,
  monthLabel,
  parseMoney,
  pluralize,
  validateAcademicDate,
  validateFinancialDate,
  validateGoal,
  validateProduction,
} from "../src/model.js";
import { DEFAULT_CONSULTANT_RATES, DEFAULT_MANAGER_TIERS, MODALITIES } from "../src/config.js";

function production(values = {}) {
  return Object.fromEntries(MODALITIES.map(({ id }) => [id, values[id] || { inscritos: 0, matfin: 0, matacad: 0 }]));
}

test("meta aceita somente inteiro maior ou igual a 1", () => {
  for (const value of ["", 0, -1, "1,5", 1.5]) {
    assert.equal(validateGoal(value).valid, false);
    assert.equal(validateGoal(value).message, "A meta mínima é 1 matrícula");
  }
  assert.deepEqual(validateGoal("1"), { valid: true, value: 1, message: "" });
});

test("metas e produção rejeitam overflow e inteiros inseguros", () => {
  assert.deepEqual(validateGoal("100000"), { valid: false, value: null, message: "A meta máxima é 99.999 matrículas" });
  assert.deepEqual(validateProduction("100000"), { valid: false, value: null, message: "O valor máximo por etapa é 99.999" });
  assert.equal(validateGoal(String(Number.MAX_SAFE_INTEGER + 1)).message, "A meta deve ser um número inteiro seguro");
  assert.equal(validateProduction(String(Number.MAX_SAFE_INTEGER + 1)).message, "Informe uma quantidade inteira segura");
  assert.deepEqual(validateProduction("99999"), { valid: true, value: 99999, message: "" });
});

test("valor monetário rejeita Infinity, precisão insegura e conteúdo malformado", () => {
  assert.equal(parseMoney("R$ 1.234,56"), 1234.56);
  assert.equal(parseMoney(5000.5), 5000.5);
  assert.equal(parseMoney("9".repeat(400)), null);
  assert.equal(parseMoney(Infinity), null);
  assert.equal(parseMoney("12,345"), null);
  assert.equal(parseMoney(""), null);
});

test("datas respeitam mês financeiro e semestre acadêmico", () => {
  assert.equal(validateFinancialDate("2026-08-31", "2026-08").valid, true);
  assert.equal(validateFinancialDate("2026-09-01", "2026-08").valid, false);
  assert.equal(validateAcademicDate("2026-12-31", "2026-08").valid, true);
  assert.equal(validateAcademicDate("2027-01-01", "2026-08").valid, false);
});

test("conversão sem denominador retorna Sem base e permite superar 100%", () => {
  assert.equal(conversionLabel(conversion(0, 0)), "Sem base");
  assert.equal(conversion(15, 10), 150);
});

test("localização usa PT-BR e pluralização correta", () => {
  assert.equal(monthLabel("2026-08"), "Agosto de 2026");
  assert.equal(monthLabel("2026-09"), "Setembro de 2026");
  assert.equal(pluralize(1, "Matrícula", "Matrículas"), "Matrícula");
  assert.equal(pluralize(20, "Matrícula", "Matrículas"), "Matrículas");
});

test("consultor usa o menor atingimento e aplica divisão 60/40", () => {
  const monthState = { financialGoal: 10, salary: 0, production: production({ ead: { inscritos: 12, matfin: 10, matacad: 8 } }) };
  const result = calculateMonth({ profile: "consultor", monthState, semesterAcademicCount: 8, academicGoal: 10, consultantRates: DEFAULT_CONSULTANT_RATES, managerTiers: DEFAULT_MANAGER_TIERS });
  assert.equal(result.tier.label, "80%–99,99%");
  assert.equal(result.gross, 250);
  assert.equal(result.released, 150);
  assert.equal(result.retained, 100);
});

test("gerente aplica percentual da faixa ao salário", () => {
  const monthState = { financialGoal: 10, salary: 5000, production: production({ ead: { inscritos: 12, matfin: 10, matacad: 10 } }) };
  const result = calculateMonth({ profile: "gerente", monthState, semesterAcademicCount: 10, academicGoal: 10, consultantRates: DEFAULT_CONSULTANT_RATES, managerTiers: DEFAULT_MANAGER_TIERS });
  assert.equal(result.gross, 1500);
  assert.equal(result.released, 900);
  assert.equal(result.retained, 600);
});
