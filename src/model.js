import {
  CONSULTANT_TIERS,
  DEFAULT_MANAGER_TIERS,
  MODALITIES,
} from "./config.js";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const pluralRules = new Intl.PluralRules("pt-BR");
export const MAX_QUANTITY = 99_999;

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
export function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function formatNumber(value) {
  return numberFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)}%`;
}

export function pluralize(value, singular, plural) {
  return pluralRules.select(Number(value)) === "one" ? singular : plural;
}

export function quantityLabel(value, singular, plural) {
  return `${formatNumber(value)} ${pluralize(value, singular, plural)}`;
}

export function validMonthKey(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey) {
  if (!validMonthKey(monthKey)) return "Período inválido";
  const [year, month] = monthKey.split("-").map(Number);
  const label = monthFormatter.format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function parseLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function formatDate(value) {
  const date = value instanceof Date ? value : parseLocalDate(value);
  return date ? dateFormatter.format(date) : "Data inválida";
}

export function lastDayOfMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

export function financialDeadlineFor(monthKey, preferredDay = 31) {
  const day = Math.min(Math.max(1, Number(preferredDay) || 31), lastDayOfMonth(monthKey));
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function semesterMeta(monthKey) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const number = month <= 6 ? 1 : 2;
  const start = number === 1 ? 1 : 7;
  const end = number === 1 ? 6 : 12;
  return { year, number, start, end, key: `${year}-S${number}`, label: `${number}º semestre de ${year}` };
}

export function academicDeadlineFor(monthKey) {
  const semester = semesterMeta(monthKey);
  const deadlineMonth = String(semester.end).padStart(2, "0");
  const key = `${semester.year}-${deadlineMonth}`;
  return `${key}-${String(lastDayOfMonth(key)).padStart(2, "0")}`;
}

export function validateGoal(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) < 1) {
    return { valid: false, value: null, message: "A meta mínima é 1 matrícula" };
  }
  const number = Number(normalized);
  if (!Number.isSafeInteger(number)) {
    return { valid: false, value: null, message: "A meta deve ser um número inteiro seguro" };
  }
  if (number > MAX_QUANTITY) {
    return { valid: false, value: null, message: "A meta máxima é 99.999 matrículas" };
  }
  return { valid: true, value: number, message: "" };
}

export function validateProduction(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, value: null, message: "Informe um número inteiro igual ou maior que 0" };
  }
  const number = Number(normalized);
  if (!Number.isSafeInteger(number)) {
    return { valid: false, value: null, message: "Informe uma quantidade inteira segura" };
  }
  if (number > MAX_QUANTITY) {
    return { valid: false, value: null, message: "O valor máximo por etapa é 99.999" };
  }
  return { valid: true, value: number, message: "" };
}

export function parseMoney(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isSafeInteger(value * 100) ? value : null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "")
    .replaceAll(".", "")
    .replace(",", ".");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number) || !Number.isSafeInteger(number * 100)) return null;
  return number;
}

export function validateFinancialDate(value, monthKey) {
  const date = parseLocalDate(value);
  if (!date || value.slice(0, 7) !== monthKey) {
    return { valid: false, message: "A data financeira deve pertencer ao mês de referência" };
  }
  return { valid: true, message: "" };
}

export function validateAcademicDate(value, monthKey) {
  const date = parseLocalDate(value);
  const semester = semesterMeta(monthKey);
  const month = date ? date.getUTCMonth() + 1 : 0;
  if (!date || date.getUTCFullYear() !== semester.year || month < semester.start || month > semester.end) {
    return { valid: false, message: "A data acadêmica deve pertencer ao semestre de referência" };
  }
  return { valid: true, message: "" };
}

export function conversion(numerator, denominator) {
  const base = Number(denominator);
  if (!Number.isFinite(base) || base <= 0) return null;
  return (Number(numerator) / base) * 100;
}

export function conversionLabel(value) {
  return value === null ? "Sem base" : formatPercent(value);
}

export function productionTotals(production) {
  return MODALITIES.reduce(
    (totals, modality) => {
      const row = production[modality.id] || {};
      totals.inscritos += Number(row.inscritos) || 0;
      totals.matfin += Number(row.matfin) || 0;
      totals.matacad += Number(row.matacad) || 0;
      return totals;
    },
    { inscritos: 0, matfin: 0, matacad: 0 },
  );
}

export function tierIndexFor(attainment, tiers) {
  return tiers.reduce((index, tier, candidate) => (attainment >= tier.min ? candidate : index), 0);
}

export function attainmentTone(attainment) {
  if (attainment < 0.5) return "danger";
  if (attainment < 1) return "warning";
  return "success";
}

export function calculateMonth({
  profile,
  monthState,
  semesterAcademicCount,
  academicGoal,
  consultantRates,
  managerTiers = DEFAULT_MANAGER_TIERS,
}) {
  const totals = productionTotals(monthState.production);
  const financialAttainment = totals.matfin / Math.max(1, monthState.financialGoal);
  const academicAttainment = semesterAcademicCount / Math.max(1, academicGoal);
  const combinedAttainment = Math.min(financialAttainment, academicAttainment);
  let tier;
  let entries;
  let gross;

  if (profile === "gerente") {
    const tierIndex = tierIndexFor(combinedAttainment, managerTiers);
    tier = managerTiers[tierIndex];
    gross = Math.max(0, Number(monthState.salary) || 0) * tier.multiplier;
    entries = MODALITIES.map((modality) => {
      const count = Number(monthState.production[modality.id]?.matfin) || 0;
      const share = totals.matfin > 0 ? count / totals.matfin : 0;
      const entryGross = gross * share;
      return { ...modality, count, rate: tier.multiplier, gross: entryGross, released: entryGross * 0.6 };
    });
  } else {
    const tierIndex = tierIndexFor(combinedAttainment, CONSULTANT_TIERS);
    tier = CONSULTANT_TIERS[tierIndex];
    entries = MODALITIES.map((modality) => {
      const count = Number(monthState.production[modality.id]?.matfin) || 0;
      const rate = Number(consultantRates[modality.id]?.[tierIndex]) || 0;
      const entryGross = count * rate;
      return { ...modality, count, rate, gross: entryGross, released: entryGross * 0.6 };
    });
    gross = entries.reduce((total, entry) => total + entry.gross, 0);
  }

  return {
    profile,
    totals,
    financialAttainment,
    academicAttainment,
    combinedAttainment,
    tier,
    tone: attainmentTone(combinedAttainment),
    entries,
    gross,
    released: gross * 0.6,
    retained: gross * 0.4,
  };
}

export function daysBetween(from, to) {
  const start = from instanceof Date ? from : parseLocalDate(from);
  const end = to instanceof Date ? to : parseLocalDate(to);
  if (!start || !end) return 0;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function paceFor(remaining, days) {
  const safeDays = Math.max(1, days);
  return {
    period: Math.max(0, remaining),
    week: Math.ceil((Math.max(0, remaining) * 7) / safeDays),
    day: Math.ceil(Math.max(0, remaining) / safeDays),
  };
}
