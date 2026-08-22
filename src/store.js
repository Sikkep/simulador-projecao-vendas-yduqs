import {
  DEFAULT_CONSULTANT_RATES,
  DEFAULT_GOALS,
  DEFAULT_MANAGER_TIERS,
  DEFAULT_PRODUCTION,
  MODALITIES,
} from "./config.js";
import {
  academicDeadlineFor,
  clone,
  currentMonthKey,
  financialDeadlineFor,
  semesterMeta,
  validMonthKey,
  validateAcademicDate,
  validateFinancialDate,
  validateGoal,
} from "./model.js";

const STORAGE_KEY = "yduqs-remuneracao-v3";
const LEGACY_TRACKING_KEY = "yduqs-personal-tracking-v1";
const LEGACY_CONFIG_KEY = "yduqs-sales-simulator-v2";
const LEGACY_NOTES_KEY = "yduqs-sales-notes-v1";

function emptyProduction() {
  return Object.fromEntries(MODALITIES.map(({ id }) => [id, { inscritos: 0, matfin: 0, matacad: 0 }]));
}

function normalizeProduction(source, fallback = emptyProduction()) {
  return Object.fromEntries(
    MODALITIES.map((modality) => {
      const legacy = source?.[modality.legacyId];
      const current = source?.[modality.id];
      const row = current || legacy || fallback[modality.id] || {};
      return [
        modality.id,
        {
          inscritos: Math.max(0, Math.floor(Number(row.inscritos) || 0)),
          matfin: Math.max(0, Math.floor(Number(row.matfin) || 0)),
          matacad: Math.max(0, Math.floor(Number(row.matacad) || 0)),
        },
      ];
    }),
  );
}

function createMonth(profile, monthKey, example = false) {
  const defaults = DEFAULT_GOALS[profile];
  return {
    financialGoal: defaults.financial,
    financialDeadline: financialDeadlineFor(monthKey),
    salary: defaults.salary,
    production: normalizeProduction(example ? DEFAULT_PRODUCTION[profile] : null, example ? DEFAULT_PRODUCTION[profile] : emptyProduction()),
    example,
    snapshot: null,
  };
}

function createSemester(profile, monthKey) {
  return {
    academicGoal: DEFAULT_GOALS[profile].academic,
    academicDeadline: academicDeadlineFor(monthKey),
  };
}

function createProfile(profile, monthKey) {
  const semester = semesterMeta(monthKey);
  return {
    selectedMonth: monthKey,
    months: { [monthKey]: createMonth(profile, monthKey, true) },
    semesters: { [semester.key]: createSemester(profile, monthKey) },
  };
}

export function createDefaultState(monthKey = currentMonthKey()) {
  const validMonth = validMonthKey(monthKey) ? monthKey : currentMonthKey();
  return {
    version: 3,
    config: {
      consultantRates: clone(DEFAULT_CONSULTANT_RATES),
      managerTiers: clone(DEFAULT_MANAGER_TIERS),
    },
    profiles: {
      consultor: createProfile("consultor", validMonth),
      gerente: createProfile("gerente", validMonth),
    },
    notes: { consultor: [], gerente: [] },
  };
}

function safeJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

function migrateRates(result, legacyConfig) {
  const product = legacyConfig?.consultor_geral || legacyConfig?.consultor_graduacao;
  if (!product?.rates) return;
  MODALITIES.forEach((modality) => {
    const tiers = product.rates[modality.legacyId]?.tiers;
    if (Array.isArray(tiers) && tiers.length === result.config.consultantRates[modality.id].length) {
      result.config.consultantRates[modality.id] = tiers.map((value, index) => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : result.config.consultantRates[modality.id][index];
      });
    }
  });
  const manager = legacyConfig?.gerente_geral || legacyConfig?.gerente_graduacao;
  if (Array.isArray(manager?.managerTiers)) {
    result.config.managerTiers = result.config.managerTiers.map((tier, index) => ({
      ...tier,
      multiplier: Math.max(0, Number(manager.managerTiers[index]?.multiplier) || tier.multiplier),
    }));
  }
}

function migrateLegacy(storage) {
  const result = createDefaultState();
  const tracking = safeJson(storage, LEGACY_TRACKING_KEY);
  const legacyConfig = safeJson(storage, LEGACY_CONFIG_KEY);
  const legacyNotes = safeJson(storage, LEGACY_NOTES_KEY);
  migrateRates(result, legacyConfig);

  for (const profile of ["consultor", "gerente"]) {
    const legacy = tracking?.[`${profile}_geral`] || tracking?.[`${profile}_graduacao`];
    if (!legacy?.months || typeof legacy.months !== "object") continue;
    const migratedProfile = { selectedMonth: validMonthKey(legacy.selectedMonth) ? legacy.selectedMonth : currentMonthKey(), months: {}, semesters: {} };
    Object.entries(legacy.months).forEach(([monthKey, month]) => {
      if (!validMonthKey(monthKey)) return;
      const goal = validateGoal(month.goal);
      const financialDeadline = validateFinancialDate(month.date, monthKey).valid ? month.date : financialDeadlineFor(monthKey);
      migratedProfile.months[monthKey] = {
        financialGoal: goal.valid ? goal.value : DEFAULT_GOALS[profile].financial,
        financialDeadline,
        salary: Math.max(0, Number(month.salary) || DEFAULT_GOALS[profile].salary),
        production: normalizeProduction(month.production),
        example: false,
        snapshot: null,
      };
      const semester = semesterMeta(monthKey);
      const academicGoalCandidate = legacy.academicGoals?.[semester.key] ?? month.academicGoal;
      const academicGoal = validateGoal(academicGoalCandidate);
      const academicDateCandidate = legacy.academicDates?.[semester.key];
      migratedProfile.semesters[semester.key] = {
        academicGoal: academicGoal.valid ? academicGoal.value : DEFAULT_GOALS[profile].academic,
        academicDeadline: validateAcademicDate(academicDateCandidate, monthKey).valid ? academicDateCandidate : academicDeadlineFor(monthKey),
      };
    });
    ensureProfileMonth({ profiles: { [profile]: migratedProfile } }, profile, migratedProfile.selectedMonth);
    result.profiles[profile] = migratedProfile;
  }

  if (legacyNotes && typeof legacyNotes === "object") {
    for (const profile of ["consultor", "gerente"]) {
      result.notes[profile] = Array.isArray(legacyNotes[profile]) ? legacyNotes[profile] : [];
    }
  }
  return result;
}

function normalizeState(raw) {
  const fallback = createDefaultState();
  if (!raw || raw.version !== 3 || !raw.profiles) return fallback;
  const result = fallback;
  result.config.consultantRates = clone(raw.config?.consultantRates || fallback.config.consultantRates);
  result.config.managerTiers = clone(raw.config?.managerTiers || fallback.config.managerTiers);
  for (const profile of ["consultor", "gerente"]) {
    const source = raw.profiles[profile];
    if (!source) continue;
    result.profiles[profile] = {
      selectedMonth: validMonthKey(source.selectedMonth) ? source.selectedMonth : currentMonthKey(),
      months: {},
      semesters: {},
    };
    Object.entries(source.months || {}).forEach(([monthKey, month]) => {
      if (!validMonthKey(monthKey)) return;
      result.profiles[profile].months[monthKey] = {
        financialGoal: validateGoal(month.financialGoal).valid ? Number(month.financialGoal) : DEFAULT_GOALS[profile].financial,
        financialDeadline: validateFinancialDate(month.financialDeadline, monthKey).valid ? month.financialDeadline : financialDeadlineFor(monthKey),
        salary: Math.max(0, Number(month.salary) || 0),
        production: normalizeProduction(month.production),
        example: Boolean(month.example),
        snapshot: month.snapshot && typeof month.snapshot === "object" ? month.snapshot : null,
      };
    });
    Object.entries(source.semesters || {}).forEach(([semesterKey, semester]) => {
      const relatedMonth = `${semesterKey.slice(0, 4)}-${semesterKey.endsWith("1") ? "01" : "07"}`;
      result.profiles[profile].semesters[semesterKey] = {
        academicGoal: validateGoal(semester.academicGoal).valid ? Number(semester.academicGoal) : DEFAULT_GOALS[profile].academic,
        academicDeadline: validateAcademicDate(semester.academicDeadline, relatedMonth).valid ? semester.academicDeadline : academicDeadlineFor(relatedMonth),
      };
    });
    ensureProfileMonth(result, profile, result.profiles[profile].selectedMonth);
  }
  result.notes = {
    consultor: Array.isArray(raw.notes?.consultor) ? raw.notes.consultor : [],
    gerente: Array.isArray(raw.notes?.gerente) ? raw.notes.gerente : [],
  };
  return result;
}

export function loadState(storage = window.localStorage) {
  const current = safeJson(storage, STORAGE_KEY);
  if (current) return normalizeState(current);
  const migrated = migrateLegacy(storage);
  saveState(migrated, storage);
  return migrated;
}

export function saveState(state, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ensureProfileMonth(state, profile, monthKey) {
  if (!state.profiles[profile]) state.profiles[profile] = createProfile(profile, monthKey);
  const profileState = state.profiles[profile];
  if (!profileState.months[monthKey]) profileState.months[monthKey] = createMonth(profile, monthKey, false);
  const semester = semesterMeta(monthKey);
  if (!profileState.semesters[semester.key]) profileState.semesters[semester.key] = createSemester(profile, monthKey);
  profileState.selectedMonth = monthKey;
  return {
    profileState,
    monthState: profileState.months[monthKey],
    semesterState: profileState.semesters[semester.key],
  };
}

export function semesterProduction(state, profile, monthKey) {
  const semester = semesterMeta(monthKey);
  const total = emptyProduction();
  Object.entries(state.profiles[profile].months).forEach(([key, month]) => {
    const candidate = semesterMeta(key);
    if (candidate.key !== semester.key) return;
    MODALITIES.forEach(({ id }) => {
      total[id].inscritos += Number(month.production[id]?.inscritos) || 0;
      total[id].matfin += Number(month.production[id]?.matfin) || 0;
      total[id].matacad += Number(month.production[id]?.matacad) || 0;
    });
  });
  return total;
}

export function allMonthsInSemester(state, profile, monthKey) {
  const semester = semesterMeta(monthKey);
  return Object.entries(state.profiles[profile].months)
    .filter(([key]) => semesterMeta(key).key === semester.key)
    .sort(([a], [b]) => a.localeCompare(b));
}

export function resetProductionToZero(monthState) {
  monthState.production = emptyProduction();
  monthState.example = false;
  monthState.snapshot = null;
}

export { STORAGE_KEY };
