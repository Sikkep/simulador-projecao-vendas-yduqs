import {
  CONSULTANT_TIERS,
  MODALITIES,
  PROFILE_LABELS,
  ROUTES,
} from "./config.js";
import {
  calculateMonth,
  conversion,
  conversionLabel,
  currentMonthKey,
  daysBetween,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  monthLabel,
  paceFor,
  productionTotals,
  quantityLabel,
  semesterMeta,
  validateAcademicDate,
  validateFinancialDate,
  validateGoal,
  validateProduction,
  validMonthKey,
} from "./model.js";
import {
  allMonthsInSemester,
  ensureProfileMonth,
  loadState,
  resetProductionToZero,
  saveState,
  semesterProduction,
} from "./store.js";

const main = document.querySelector("#main-content");
const sidebar = document.querySelector("#sidebar");
const menuToggle = document.querySelector("#menu-toggle");
const menuOverlay = document.querySelector("#menu-overlay");
const loginDialog = document.querySelector("#login-dialog");
const adminDialog = document.querySelector("#admin-dialog");
const loginForm = document.querySelector("#login-form");
const adminForm = document.querySelector("#admin-form");
const toast = document.querySelector("#toast");

let state = loadState();
let route = normalizeRoute(location.pathname);
let lastDialogTrigger = null;
let toastTimer = null;
let animationFrame = null;
let lastHeroValue = null;
let recalculateTimer = null;
const ui = { periodTab: "mensal" };

function normalizeRoute(pathname) {
  const clean = `/${String(pathname || "").split("/").filter(Boolean)[0] || ""}`;
  return Object.values(ROUTES).includes(clean) ? clean : ROUTES.projection;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function activeProfile() {
  const value = new URLSearchParams(location.search).get("perfil");
  return value === "gerente" ? "gerente" : "consultor";
}

function activeMonth(profile = activeProfile()) {
  const queryMonth = new URLSearchParams(location.search).get("mes");
  if (validMonthKey(queryMonth)) return queryMonth;
  const stored = state.profiles[profile]?.selectedMonth;
  return validMonthKey(stored) ? stored : currentMonthKey();
}

function context(profile = activeProfile(), monthKey = activeMonth(profile)) {
  const ensured = ensureProfileMonth(state, profile, monthKey);
  const semesterData = semesterProduction(state, profile, monthKey);
  const semesterTotals = productionTotals(semesterData);
  const result = calculateMonth({
    profile,
    monthState: ensured.monthState,
    semesterAcademicCount: semesterTotals.matacad,
    academicGoal: ensured.semesterState.academicGoal,
    consultantRates: state.config.consultantRates,
    managerTiers: state.config.managerTiers,
  });
  return { profile, monthKey, ...ensured, semesterData, semesterTotals, result };
}

function persist() {
  saveState(state);
}

function updateUrl(nextRoute, params = {}, { replace = false } = {}) {
  const query = new URLSearchParams(location.search);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") query.delete(key);
    else query.set(key, String(value));
  });
  const url = `${nextRoute}${query.size ? `?${query}` : ""}`;
  history[replace ? "replaceState" : "pushState"]({}, "", url);
  route = normalizeRoute(nextRoute);
}

function syncProductionQuery(ctx) {
  const query = new URLSearchParams();
  query.set("mes", ctx.monthKey);
  query.set("perfil", ctx.profile);
  MODALITIES.forEach(({ id }) => {
    const row = ctx.monthState.production[id];
    query.set(id, `${row.inscritos},${row.matfin},${row.matacad}`);
  });
  history.replaceState({}, "", `${route}?${query}`);
}

function applyProductionQuery(ctx) {
  const query = new URLSearchParams(location.search);
  let changed = false;
  MODALITIES.forEach(({ id }) => {
    const candidate = query.get(id);
    if (!candidate || !/^\d+,\d+,\d+$/.test(candidate)) return;
    const [inscritos, matfin, matacad] = candidate.split(",").map(Number);
    ctx.monthState.production[id] = { inscritos, matfin, matacad };
    ctx.monthState.example = false;
    changed = true;
  });
  if (changed) persist();
  return changed;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.visible = "true";
  toastTimer = setTimeout(() => {
    toast.dataset.visible = "false";
  }, 2600);
}

function currencyMarkup(value, className = "money") {
  const formatted = formatCurrency(value).replace(/^R\$\s?/, "");
  return `<span class="${className}"><span class="money__currency">R$</span>${formatted}</span>`;
}

function calendarIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;
}

function pageHeader({ eyebrow, title, description, controls = "" }) {
  return `<header class="page-header">
    <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="page-description">${escapeHtml(description)}</p></div>
    ${controls}
  </header>`;
}

function profileSelect(profile, id = "profile-select") {
  return `<div class="field profile-switch"><label for="${id}">Perfil</label><select id="${id}" data-profile-select>
    <option value="consultor" ${profile === "consultor" ? "selected" : ""}>Consultor</option>
    <option value="gerente" ${profile === "gerente" ? "selected" : ""}>Gerente</option>
  </select></div>`;
}

function monthSelect(monthKey, id = "month-select") {
  return `<div class="field month-switch"><label for="${id}">Mês de referência</label><select id="${id}" data-month-select>${monthOptions(monthKey)}</select></div>`;
}

function monthOptions(centerMonth, before = 18, after = 18) {
  const [year, month] = centerMonth.split("-").map(Number);
  const options = [];
  for (let offset = -before; offset <= after; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    options.push(`<option value="${key}" ${key === centerMonth ? "selected" : ""}>${monthLabel(key)}</option>`);
  }
  return options.join("");
}

function moneyHero(result, valid = true) {
  const tier = valid ? result.tier.label : "Aguardando correção";
  const tone = valid ? result.tone : "danger";
  return `<section class="card card--sticky hero-card" aria-labelledby="resultado-title">
    <div><p class="eyebrow">2 · Resultado</p><h2 id="resultado-title">Remuneração estimada</h2></div>
    <p class="hero-eyebrow">Liberado no mês — 60%</p>
    <div class="hero-money" id="hero-money" data-value="${valid ? result.released : 0}" role="status" aria-live="polite">
      ${valid ? currencyMarkup(result.released, "hero-money__value") : "—"}
    </div>
    <p class="legal-copy">Este é apenas um simulador e não reflete o valor real a ser creditado, para mais informações, consulte o RH.</p>
    <div class="financial-summary">
      <div class="metric-line"><span>Valor bruto calculado</span>${valid ? currencyMarkup(result.gross) : "—"}</div>
      <div class="metric-line"><span>Liberado no mês — 60%</span>${valid ? currencyMarkup(result.released) : "—"}</div>
      <div class="metric-line"><span>Saldo retido para fechamento do semestre — 40%</span>${valid ? currencyMarkup(result.retained) : "—"}</div>
    </div>
    <div class="attainment" data-tone="${tone}">
      <strong>Faixa de atingimento</strong><strong class="attainment__value">${tier}</strong>
      <span class="attainment__bar" aria-hidden="true"><span class="attainment__fill" style="width:${valid ? Math.min(100, result.combinedAttainment * 50) : 0}%"></span></span>
    </div>
  </section>`;
}

function validateProjectionContext(ctx) {
  return {
    financialGoal: validateGoal(ctx.monthState.financialGoal),
    academicGoal: validateGoal(ctx.semesterState.academicGoal),
    financialDate: validateFinancialDate(ctx.monthState.financialDeadline, ctx.monthKey),
    academicDate: validateAcademicDate(ctx.semesterState.academicDeadline, ctx.monthKey),
  };
}

function productionTable(ctx) {
  const rows = MODALITIES.map((modality) => {
    const row = ctx.monthState.production[modality.id];
    const entry = ctx.result.entries.find((candidate) => candidate.id === modality.id);
    return `<tr data-row="${modality.id}">
      <td class="row-title">${escapeHtml(modality.label)}</td>
      <td><input type="text" inputmode="numeric" value="${row.inscritos}" data-production="${modality.id}:inscritos" aria-label="Inscritos em ${escapeHtml(modality.label)}"></td>
      <td><input type="text" inputmode="numeric" value="${row.matfin}" data-production="${modality.id}:matfin" aria-label="Matrículas Financeiras em ${escapeHtml(modality.label)}"></td>
      <td class="conversion-cell"><strong>${conversionLabel(conversion(row.matfin, row.inscritos))}</strong><small>Inscritos → Financeira</small></td>
      <td><input type="text" inputmode="numeric" value="${row.matacad}" data-production="${modality.id}:matacad" aria-label="Matrículas Acadêmicas em ${escapeHtml(modality.label)}"></td>
      <td class="conversion-cell"><strong>${conversionLabel(conversion(row.matacad, row.matfin))}</strong><small>Financeira → Acadêmica</small></td>
      <td data-row-value="${modality.id}">${currencyMarkup(entry?.released || 0)}</td>
    </tr>`;
  }).join("");

  const total = ctx.result.totals;
  const mobileRows = MODALITIES.map((modality) => {
    const row = ctx.monthState.production[modality.id];
    const entry = ctx.result.entries.find((candidate) => candidate.id === modality.id);
    return `<article class="production-row-card" data-row="${modality.id}">
      <h3>${escapeHtml(modality.label)}</h3>
      ${mobileInputPair("Inscritos", modality.id, "inscritos", row.inscritos)}
      ${mobileInputPair("Matrícula Financeira", modality.id, "matfin", row.matfin)}
      <div class="mobile-pair"><span>Conversão para Financeira</span><strong class="metric-value">${conversionLabel(conversion(row.matfin, row.inscritos))}</strong></div>
      ${mobileInputPair("Matrícula Acadêmica", modality.id, "matacad", row.matacad)}
      <div class="mobile-pair"><span>Conversão para Acadêmica</span><strong class="metric-value">${conversionLabel(conversion(row.matacad, row.matfin))}</strong></div>
      <div class="mobile-pair"><span>Valor liberado</span>${currencyMarkup(entry?.released || 0, "metric-value")}</div>
    </article>`;
  }).join("");

  return `<div class="table-wrap">
    <table class="production-table">
      <caption class="eyebrow">Produção por modalidade e conversões</caption>
      <colgroup><col style="width:22%"><col style="width:11%"><col style="width:13%"><col style="width:14%"><col style="width:13%"><col style="width:14%"><col style="width:13%"></colgroup>
      <thead><tr><th scope="col">Modalidade</th><th scope="col">Inscritos</th><th scope="col"><abbr title="Matrícula Financeira">Financeira</abbr></th><th scope="col">Conversão</th><th scope="col"><abbr title="Matrícula Acadêmica">Acadêmica</abbr></th><th scope="col">Conversão</th><th scope="col">Valor liberado</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total geral</td><td class="total-cell">${formatNumber(total.inscritos)}</td><td class="total-cell">${formatNumber(total.matfin)}</td><td class="total-cell">${conversionLabel(conversion(total.matfin, total.inscritos))}</td><td class="total-cell">${formatNumber(total.matacad)}</td><td class="total-cell">${conversionLabel(conversion(total.matacad, total.matfin))}</td><td>${currencyMarkup(ctx.result.released)}</td></tr></tfoot>
    </table>
  </div><div class="mobile-production-list">${mobileRows}</div>`;
}

function mobileInputPair(label, modality, field, value) {
  return `<div class="mobile-pair"><label for="mobile-${modality}-${field}">${label}</label><input id="mobile-${modality}-${field}" type="text" inputmode="numeric" value="${value}" data-production="${modality}:${field}"></div>`;
}

function paceSection(ctx) {
  const current = currentMonthKey();
  const today = new Date();
  const start = ctx.monthKey === current
    ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    : `${ctx.monthKey}-01`;
  const financialDays = daysBetween(start, ctx.monthState.financialDeadline);
  const academicDays = daysBetween(start, ctx.semesterState.academicDeadline);
  const financial = paceFor(ctx.monthState.financialGoal - ctx.result.totals.matfin, financialDays);
  const academic = paceFor(ctx.semesterState.academicGoal - ctx.semesterTotals.matacad, academicDays);
  const cards = [
    ["No período", financial.period, academic.period, "Matrícula Financeira/mês", "Matrícula Acadêmica/semestre"],
    ["Por semana", financial.week, academic.week, "Matrícula Financeira", "Matrícula Acadêmica"],
    ["Por dia", financial.day, academic.day, "Matrícula Financeira", "Matrícula Acadêmica"],
  ];
  return `<section class="card" aria-labelledby="pace-title">
    <div class="section-heading"><div><p class="eyebrow">Planejamento</p><h2 id="pace-title">Sugestão de ritmo</h2></div><p class="muted">Necessidade mínima do mês e do semestre</p></div>
    <div class="pace-grid">${cards.map(([title, fin, acad, finLabel, acadLabel]) => `<article class="pace-card"><p>${title}</p><div class="pace-metric"><strong>${fin}</strong><span>${finLabel}</span></div><div class="pace-metric"><strong>${acad}</strong><span>${acadLabel}</span></div></article>`).join("")}</div>
    <p class="section-description space-top-4">Faltam ${quantityLabel(financial.period, "Matrícula Financeira", "Matrículas Financeiras")} no mês selecionado e ${quantityLabel(academic.period, "Matrícula Acadêmica", "Matrículas Acadêmicas")} no semestre.</p>
  </section>`;
}

function renderProjection() {
  const profile = activeProfile();
  const monthKey = activeMonth(profile);
  let ctx = context(profile, monthKey);
  const queryChanged = applyProductionQuery(ctx);
  if (queryChanged) ctx = context(profile, monthKey);
  const validation = validateProjectionContext(ctx);
  const valid = Object.values(validation).every((item) => item.valid);
  const exampleControls = ctx.monthState.example
    ? `<span class="badge">EXEMPLO</span><button class="button button--secondary" type="button" data-use-own>Usar meus números</button>`
    : "";
  main.innerHTML = `<div class="page">
    ${pageHeader({
      eyebrow: "Simulação comercial",
      title: "Projeção de remuneração",
      description: "Informe sua produção, acompanhe a remuneração estimada e veja o detalhamento por modalidade.",
      controls: profileSelect(profile),
    })}
    <div class="section-stack">
      <div class="step-layout">
        <section class="card" aria-labelledby="inputs-title">
          <div class="section-heading"><div><p class="eyebrow">1 · Entradas</p><h2 id="inputs-title">Produção e metas</h2></div><div class="app-header__brand flex-wrap">${exampleControls}</div></div>
          <div class="inputs-grid">
            ${monthSelect(monthKey)}
            <div class="field"><span class="field-label">Data-limite Financeira</span><div class="field-static">${calendarIcon()}<span>${formatDate(ctx.monthState.financialDeadline)}</span></div><p class="field-help">Data fixa da política para ${monthLabel(monthKey)}.</p></div>
            <div class="field"><label for="financial-goal">Meta mensal de Matrícula Financeira</label><input id="financial-goal" type="text" inputmode="numeric" value="${ctx.monthState.financialGoal}" aria-describedby="financial-goal-error"><p class="field-error" id="financial-goal-error"></p></div>
            <div class="field"><span class="field-label">Data-limite Acadêmica</span><div class="field-static">${calendarIcon()}<span>${formatDate(ctx.semesterState.academicDeadline)}</span></div><p class="field-help">Data fixa da política para o ${semesterMeta(monthKey).label}.</p></div>
            <div class="field"><label for="academic-goal">Meta semestral de Matrícula Acadêmica</label><input id="academic-goal" type="text" inputmode="numeric" value="${ctx.semesterState.academicGoal}" aria-describedby="academic-goal-error"><p class="field-error" id="academic-goal-error"></p></div>
            ${profile === "gerente" ? `<div class="field"><label for="manager-salary">Salário-base do gerente</label><input id="manager-salary" type="text" inputmode="decimal" value="${formatCurrency(ctx.monthState.salary).replace(/^R\$\s?/, "")}" aria-describedby="manager-salary-help"><p class="field-help" id="manager-salary-help">A remuneração considera o percentual da faixa de atingimento.</p></div>` : ""}
          </div>
        </section>
        ${moneyHero(ctx.result, valid)}
      </div>
      <section class="card" aria-labelledby="detail-title">
        <div class="section-heading"><div><p class="eyebrow">3 · Detalhamento</p><h2 id="detail-title">Produção, conversão e valor liberado</h2><p class="section-description">Edite uma única tabela. <abbr title="Matrícula Financeira">Financeira</abbr> e <abbr title="Matrícula Acadêmica">Acadêmica</abbr> são exibidas por extenso no mobile.</p></div></div>
        ${productionTable(ctx)}
        <p class="field-help space-top-3">Uma conversão pode ultrapassar 100% quando matrículas registradas no período incluem inscritos originados em períodos anteriores. Sem Matrícula Financeira, a conversão para Acadêmica aparece como “Sem base”.</p>
      </section>
      ${paceSection(ctx)}
    </div>
  </div>`;
  bindProjection(ctx);
  animateHero(valid ? ctx.result.released : 0);
}

function bindProjection(ctx) {
  main.querySelector("#financial-goal")?.addEventListener("change", (event) => handleGoalInput(event, ctx, "financial"));
  main.querySelector("#academic-goal")?.addEventListener("change", (event) => handleGoalInput(event, ctx, "academic"));
  main.querySelector("#manager-salary")?.addEventListener("change", (event) => {
    const value = parseMoney(event.target.value);
    ctx.monthState.salary = Math.max(0, value);
    persist();
    renderProjection();
  });
  main.querySelector("[data-use-own]")?.addEventListener("click", () => {
    resetProductionToZero(ctx.monthState);
    persist();
    syncProductionQuery(ctx);
    renderProjection();
    showToast("Campos preparados para os seus números.");
  });
  main.querySelectorAll("[data-production]").forEach((input) => input.addEventListener("input", (event) => handleProductionInput(event, ctx)));
}

function handleGoalInput(event, ctx, kind) {
  const validation = validateGoal(event.target.value);
  const error = main.querySelector(`#${kind}-goal-error`);
  event.target.setAttribute("aria-invalid", validation.valid ? "false" : "true");
  error.textContent = validation.message;
  if (!validation.valid) {
    const hero = main.querySelector("#hero-money");
    if (hero) {
      hero.textContent = "—";
      hero.setAttribute("aria-label", "Cálculo bloqueado: corrija a meta");
    }
    return;
  }
  if (kind === "financial") ctx.monthState.financialGoal = validation.value;
  else ctx.semesterState.academicGoal = validation.value;
  persist();
  const id = event.target.id;
  renderProjection();
  const restored = main.querySelector(`#${id}`);
  restored?.focus();
  restored?.select();
}

function handleProductionInput(event, ctx) {
  clearTimeout(recalculateTimer);
  const validation = validateProduction(event.target.value);
  event.target.setAttribute("aria-invalid", validation.valid ? "false" : "true");
  if (!validation.valid) {
    event.target.setAttribute("aria-describedby", "production-inline-error");
    let error = main.querySelector("#production-inline-error");
    if (!error) {
      error = document.createElement("p");
      error.id = "production-inline-error";
      error.className = "field-error";
      error.setAttribute("role", "alert");
      event.target.closest("td, .mobile-pair")?.append(error);
    }
    error.textContent = validation.message;
    const hero = main.querySelector("#hero-money");
    if (hero) {
      hero.textContent = "—";
      hero.setAttribute("aria-label", "Cálculo bloqueado: corrija a produção");
    }
    return;
  }
  const [modality, field] = event.target.dataset.production.split(":");
  recalculateTimer = setTimeout(() => {
    ctx.monthState.production[modality][field] = validation.value;
    ctx.monthState.example = false;
    persist();
    syncProductionQuery(ctx);
    renderProjection();
    const visibleInputs = [...main.querySelectorAll(`[data-production="${modality}:${field}"]`)].filter((input) => input.offsetParent !== null);
    const restored = visibleInputs[0];
    restored?.focus();
    restored?.setSelectionRange(restored.value.length, restored.value.length);
    main.querySelector(`[data-row-value="${modality}"]`)?.classList.add("flash");
  }, 280);
}

function animateHero(value) {
  const element = main.querySelector("#hero-money");
  if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lastHeroValue = value;
    return;
  }
  const startValue = Number.isFinite(lastHeroValue) ? lastHeroValue : 0;
  cancelAnimationFrame(animationFrame);
  const start = performance.now();
  const duration = 320;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    element.innerHTML = currencyMarkup(startValue + (value - startValue) * eased, "hero-money__value");
    if (progress < 1) animationFrame = requestAnimationFrame(tick);
    else lastHeroValue = value;
  };
  animationFrame = requestAnimationFrame(tick);
}

function parseMoney(value) {
  const normalized = String(value || "").replace(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function semesterCalculations(profile, monthKey) {
  const semester = semesterMeta(monthKey);
  const semesterData = semesterProduction(state, profile, monthKey);
  const semesterTotals = productionTotals(semesterData);
  const academicGoal = ensureProfileMonth(state, profile, monthKey).semesterState.academicGoal;
  const months = allMonthsInSemester(state, profile, monthKey).map(([key, monthState]) => ({
    key,
    calculation: calculateMonth({
      profile,
      monthState,
      semesterAcademicCount: semesterTotals.matacad,
      academicGoal,
      consultantRates: monthState.snapshot?.consultantRates || state.config.consultantRates,
      managerTiers: monthState.snapshot?.managerTiers || state.config.managerTiers,
    }),
  }));
  return { semester, semesterData, semesterTotals, months };
}

function tabsMarkup() {
  return `<div class="tabs" role="tablist" aria-label="Período dos resultados">
    <button class="tab" id="tab-mensal" type="button" role="tab" aria-selected="${ui.periodTab === "mensal"}" aria-controls="panel-mensal" tabindex="${ui.periodTab === "mensal" ? 0 : -1}" data-tab="mensal">Mensal</button>
    <button class="tab" id="tab-semestral" type="button" role="tab" aria-selected="${ui.periodTab === "semestral"}" aria-controls="panel-semestral" tabindex="${ui.periodTab === "semestral" ? 0 : -1}" data-tab="semestral">Semestral</button>
  </div>`;
}

function renderResults() {
  const profile = activeProfile();
  const monthKey = activeMonth(profile);
  const ctx = context(profile, monthKey);
  const semester = semesterCalculations(profile, monthKey);
  const semesterReleased = semester.months.reduce((sum, item) => sum + item.calculation.released, 0);
  const semesterRetained = semester.months.reduce((sum, item) => sum + item.calculation.retained, 0);
  const semesterGross = semester.months.reduce((sum, item) => sum + item.calculation.gross, 0);
  const monthlyPanel = resultsPanel({
    id: "mensal",
    hidden: ui.periodTab !== "mensal",
    label: monthLabel(monthKey),
    totals: ctx.result.totals,
    production: ctx.monthState.production,
    gross: ctx.result.gross,
    released: ctx.result.released,
    retained: ctx.result.retained,
  });
  const semesterPanel = resultsPanel({
    id: "semestral",
    hidden: ui.periodTab !== "semestral",
    label: semester.semester.label,
    totals: semester.semesterTotals,
    production: semester.semesterData,
    gross: semesterGross,
    released: semesterReleased,
    retained: semesterRetained,
  });
  main.innerHTML = `<div class="page">
    ${pageHeader({ eyebrow: "Acompanhamento", title: "Resultados", description: "Consolide produção, conversões e remuneração por perfil e período.", controls: `<div class="app-header__brand flex-wrap">${profileSelect(profile, "results-profile")}${monthSelect(monthKey, "results-month")}</div>` })}
    <section class="card" aria-labelledby="results-period-title"><div class="section-heading"><div><p class="eyebrow">Visão financeira</p><h2 id="results-period-title">Período do resultado</h2></div>${tabsMarkup()}</div>${monthlyPanel}${semesterPanel}</section>
  </div>`;
  bindTabs();
}

function resultsPanel({ id, hidden, label, totals, production, gross, released, retained }) {
  return `<div id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}" ${hidden ? "hidden" : ""}>
    <p class="section-description">${escapeHtml(label)}</p>
    <div class="results-grid space-top-4">
      ${kpi("Matrículas Financeiras", totals.matfin)}
      ${kpi("Conversão Inscritos → Financeira", conversionLabel(conversion(totals.matfin, totals.inscritos)))}
      ${kpi("Total já liberado", formatCurrency(released))}
      ${kpi("Saldo retido", formatCurrency(retained))}
    </div>
    <div class="details-grid space-top-4">
      <article class="detail-card"><span class="muted">Valor bruto calculado</span><div class="money">${formatCurrency(gross)}</div></article>
      <article class="detail-card"><span class="muted">Liberado no mês — 60%</span><div class="money">${formatCurrency(released)}</div></article>
      <article class="detail-card"><span class="muted">Saldo retido para fechamento do semestre — 40%</span><div class="money">${formatCurrency(retained)}</div></article>
    </div>
    <div class="charts-grid space-top-4">${distributionCard("Distribuição de Inscritos", production, "inscritos")}${distributionCard("Distribuição de Matrículas Financeiras", production, "matfin")}</div>
    ${totals.matfin === 0 ? `<p class="field-help space-top-3">A conversão para Matrícula Acadêmica está “Sem base” porque ainda não há Matrícula Financeira no período.</p>` : ""}
  </div>`;
}

function kpi(label, value) {
  return `<article class="card kpi-card"><span class="kpi-card__label">${escapeHtml(label)}</span><p class="kpi-card__value">${escapeHtml(value)}</p></article>`;
}

function distributionCard(title, production, field) {
  const values = MODALITIES.map((modality) => ({ ...modality, value: Number(production[modality.id]?.[field]) || 0 }));
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const circles = values.map((item) => {
    const fraction = total ? item.value / total : 0;
    const dash = fraction * 100;
    const circle = `<circle class="donut__segment" cx="50" cy="50" r="38" pathLength="100" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${-offset}"/>`;
    offset += dash;
    return circle;
  }).join("");
  return `<article class="card"><h2>${escapeHtml(title)}</h2>${total === 0 ? `<div class="empty-state"><h3>Sem dados neste período</h3><p class="muted">Preencha a produção em Projeção para visualizar a distribuição.</p><a class="button button--secondary" href="/projecao?perfil=${activeProfile()}&mes=${activeMonth()}">Ir para Projeção</a></div>` : `<div class="distribution"><div class="donut" role="img" aria-label="${escapeHtml(title)}: total ${total}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="donut__track" cx="50" cy="50" r="38"/>${circles}</svg><div class="donut__center"><strong>${formatNumber(total)}</strong><span>Total</span></div></div><ul class="legend">${values.map((item) => `<li><span class="legend__dot" aria-hidden="true"></span><span>${escapeHtml(item.label)}</span><span class="legend__value">${formatNumber(item.value)} · ${formatPercent((item.value / total) * 100)}</span></li>`).join("")}</ul></div>`}</article>`;
}

function bindTabs() {
  const tabs = [...main.querySelectorAll('[role="tab"]')];
  const activate = (tab, focus = false) => {
    ui.periodTab = tab.dataset.tab;
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      main.querySelector(`#panel-${candidate.dataset.tab}`).hidden = !selected;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activate(next, true);
    });
  });
}

function renderOpportunities() {
  const profile = activeProfile();
  const monthKey = activeMonth(profile);
  const ctx = context(profile, monthKey);
  const cards = MODALITIES.map((modality) => opportunityCard(modality, ctx.monthState.production[modality.id], profile, monthKey));
  const open = MODALITIES.reduce((sum, modality) => {
    const row = ctx.monthState.production[modality.id];
    return sum + Math.max(0, row.inscritos - row.matfin) + Math.max(0, row.matfin - row.matacad);
  }, 0);
  main.innerHTML = `<div class="page">
    ${pageHeader({ eyebrow: "Acompanhamento", title: "Oportunidades", description: "Veja onde atuar no funil e registre o próximo passo sem perder a modalidade.", controls: `<div class="app-header__brand flex-wrap">${profileSelect(profile, "opportunity-profile")}${monthSelect(monthKey, "opportunity-month")}</div>` })}
    <section aria-labelledby="opportunities-title"><div class="section-heading"><div><h2 id="opportunities-title">Oportunidades por modalidade</h2><p class="section-description">Diferenças nunca ficam negativas; conversões sem base são identificadas com clareza.</p></div><span class="badge">${quantityLabel(open, "oportunidade aberta", "oportunidades abertas")}</span></div>
    ${open === 0 ? `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg><h2>Funil em dia</h2><p class="muted">Não há diferenças abertas neste mês. Registre um próximo passo para manter o acompanhamento.</p><a class="button button--secondary" href="/anotacoes?perfil=${profile}&mes=${monthKey}">Registrar próximo passo</a></div>` : `<div class="opportunities-grid">${cards.join("")}</div>`}
    </section>
  </div>`;
}

function opportunityCard(modality, row, profile, monthKey) {
  const withoutFinancial = Math.max(0, row.inscritos - row.matfin);
  const withoutAcademic = Math.max(0, row.matfin - row.matacad);
  const open = withoutFinancial + withoutAcademic;
  const params = new URLSearchParams({ perfil: profile, mes: monthKey, modalidade: modality.id });
  return `<article class="card opportunity-card">
    <div class="opportunity-title"><h2>${escapeHtml(modality.label)}</h2><span class="badge">${open} abertas</span></div>
    <dl class="funnel"><div><dt>Inscritos</dt><dd>${row.inscritos}</dd></div><div><dt>Matrícula Financeira</dt><dd>${row.matfin}</dd></div><div><dt>Matrícula Acadêmica</dt><dd>${row.matacad}</dd></div></dl>
    <div class="conversion-pair"><div class="conversion-pair__item"><span><strong>${withoutFinancial}</strong><small>Sem Matrícula Financeira</small></span><strong>${conversionLabel(conversion(row.matfin, row.inscritos))}</strong></div><div class="conversion-pair__item"><span><strong>${withoutAcademic}</strong><small>Sem Matrícula Acadêmica</small></span><strong>${conversionLabel(conversion(row.matacad, row.matfin))}</strong></div></div>
    <div class="opportunity-actions"><a class="button button--primary" href="/anotacoes?${params}"><span aria-hidden="true">$</span> Tratar oportunidades</a><a class="button button--secondary" href="/anotacoes?${params}">Registrar próximo passo</a></div>
  </article>`;
}

function renderNotes() {
  const profile = activeProfile();
  const monthKey = activeMonth(profile);
  const modalityId = new URLSearchParams(location.search).get("modalidade");
  const modality = MODALITIES.find((item) => item.id === modalityId);
  const notes = state.notes[profile];
  main.innerHTML = `<div class="page">
    ${pageHeader({ eyebrow: "Organização pessoal", title: "Anotações", description: "Registre contatos e próximos passos. Os dados ficam salvos somente neste navegador.", controls: profileSelect(profile, "notes-profile") })}
    <div class="notes-layout">
      <form class="card note-form" id="note-form" novalidate>
        <div><p class="eyebrow">Novo registro</p><h2>Registrar próximo passo</h2>${modality ? `<p class="badge">${escapeHtml(modality.label)}</p>` : ""}</div>
        <div class="field"><label for="note-name">Nome</label><input id="note-name" required autocomplete="name" aria-describedby="note-name-error"><p class="field-error" id="note-name-error"></p></div>
        <div class="field"><label for="note-phone">Telefone</label><input id="note-phone" type="tel" inputmode="tel" required placeholder="(21) 98399-3854" autocomplete="tel" aria-describedby="note-phone-error"><p class="field-error" id="note-phone-error"></p></div>
        <div class="field"><label for="note-text">Anotação</label><textarea id="note-text" maxlength="500" required aria-describedby="note-text-count note-text-error" placeholder="Ex.: Irá pagar no dia 06/09 quando receber o salário.">${modality ? `Modalidade: ${modality.label}. ` : ""}</textarea><p class="character-count" id="note-text-count">${modality ? `Modalidade: ${modality.label}. `.length : 0} de 500 caracteres</p><p class="field-error" id="note-text-error"></p></div>
        <button class="button button--primary space-top-4" type="submit">Adicionar anotação</button>
        <p class="form-status" id="note-status" role="status"></p>
      </form>
      <section aria-labelledby="saved-notes-title">
        <div class="notes-toolbar"><div><p class="eyebrow">Histórico</p><h2 id="saved-notes-title">Anotações salvas</h2></div><div><button class="button button--secondary" id="export-notes" type="button" ${notes.length ? "" : "disabled"}>Exportar planilha</button>${notes.length ? "" : `<p class="export-help">Adicione ao menos uma anotação para habilitar a exportação.</p>`}</div></div>
        ${notes.length ? `<div class="notes-grid">${notes.map(noteCard).join("")}</div>` : `<div class="empty-state"><h2>Nenhuma anotação ainda</h2><p class="muted">Registre um contato e seu próximo passo para criar seu plano de acompanhamento.</p></div>`}
      </section>
    </div>
  </div>`;
  bindNotes(profile);
}

function noteCard(note) {
  return `<article class="card note-card"><div><p class="eyebrow">Contato</p><h3>${escapeHtml(note.name)}</h3></div><div class="note-card__phone"><span>${escapeHtml(note.phone)}</span><button class="icon-button" type="button" data-copy-phone="${escapeHtml(note.phone)}" aria-label="Copiar telefone de ${escapeHtml(note.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div><p class="note-card__text">${escapeHtml(note.text)}</p><div class="note-actions"><button class="button button--danger" type="button" data-delete-note="${escapeHtml(note.id)}">Excluir</button></div></article>`;
}

function bindNotes(profile) {
  const form = main.querySelector("#note-form");
  const textArea = main.querySelector("#note-text");
  textArea?.addEventListener("input", () => {
    main.querySelector("#note-text-count").textContent = `${textArea.value.length} de 500 caracteres`;
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.querySelector("#note-name");
    const phone = form.querySelector("#note-phone");
    const text = form.querySelector("#note-text");
    const validPhone = /^(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}$/.test(phone.value.trim());
    const validations = [
      [name, "note-name-error", name.value.trim() ? "" : "Informe o nome"],
      [phone, "note-phone-error", validPhone ? "" : "Informe um telefone válido com DDD"],
      [text, "note-text-error", text.value.trim() ? "" : "Escreva uma anotação"],
    ];
    validations.forEach(([field, errorId, message]) => {
      field.setAttribute("aria-invalid", String(Boolean(message)));
      main.querySelector(`#${errorId}`).textContent = message;
    });
    if (validations.some(([, , message]) => message)) return;
    state.notes[profile].unshift({ id: crypto.randomUUID(), name: name.value.trim(), phone: phone.value.trim(), text: text.value.trim(), createdAt: new Date().toISOString() });
    persist();
    renderNotes();
    showToast("Anotação adicionada.");
  });
  main.querySelectorAll("[data-copy-phone]").forEach((button) => button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copyPhone);
    showToast("Telefone copiado.");
  }));
  main.querySelectorAll("[data-delete-note]").forEach((button) => button.addEventListener("click", () => {
    state.notes[profile] = state.notes[profile].filter((note) => note.id !== button.dataset.deleteNote);
    persist();
    renderNotes();
    showToast("Anotação excluída.");
  }));
  main.querySelector("#export-notes")?.addEventListener("click", (event) => exportNotes(profile, event.currentTarget));
}

function exportNotes(profile, button) {
  button.dataset.loading = "true";
  button.disabled = true;
  const rows = [["Nome", "Telefone", "Anotação", "Data"]].concat(state.notes[profile].map((note) => [note.name, note.phone, note.text, new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))]));
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `anotacoes-${profile}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setTimeout(() => {
    button.dataset.loading = "false";
    button.disabled = false;
  }, 400);
  showToast("Planilha exportada.");
}

function render() {
  closeMenu();
  updateNavigation();
  if (route === ROUTES.results) renderResults();
  else if (route === ROUTES.opportunities) renderOpportunities();
  else if (route === ROUTES.notes) renderNotes();
  else renderProjection();
  bindGlobalPageControls();
  document.title = `${main.querySelector("h1")?.textContent || "Simulador"} · YDUQS`;
}

function bindGlobalPageControls() {
  main.querySelectorAll("[data-profile-select]").forEach((select) => select.addEventListener("change", () => {
    const month = activeMonth(select.value);
    ensureProfileMonth(state, select.value, month);
    persist();
    updateUrl(route, { perfil: select.value, mes: month }, { replace: true });
    render();
  }));
  main.querySelectorAll("[data-month-select]").forEach((input) => input.addEventListener("change", () => {
    if (!validMonthKey(input.value)) return;
    const profile = activeProfile();
    ensureProfileMonth(state, profile, input.value);
    persist();
    updateUrl(route, { perfil: profile, mes: input.value }, { replace: true });
    render();
  }));
  main.querySelectorAll('a[href^="/"]').forEach((link) => link.addEventListener("click", handleInternalLink));
}

function handleInternalLink(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.currentTarget;
  const url = new URL(link.href, location.origin);
  event.preventDefault();
  history.pushState({}, "", `${url.pathname}${url.search}`);
  route = normalizeRoute(url.pathname);
  render();
  main.focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function updateNavigation() {
  document.querySelectorAll("[data-nav-route]").forEach((link) => {
    const routeMatches = link.dataset.navRoute === route;
    const profileMatches = !link.dataset.navProfile || link.dataset.navProfile === activeProfile();
    if (routeMatches && profileMatches) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function openMenu() {
  sidebar.dataset.open = "true";
  menuOverlay.dataset.open = "true";
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Fechar menu");
  sidebar.focus();
}

function closeMenu(returnFocus = false) {
  const wasOpen = sidebar.dataset.open === "true";
  sidebar.dataset.open = "false";
  menuOverlay.dataset.open = "false";
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu");
  if (returnFocus && wasOpen) menuToggle.focus();
}

function trapFocus(event, container) {
  if (event.key !== "Tab") return;
  const elements = [...container.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((element) => element.offsetParent !== null);
  if (!elements.length) return;
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openDialog(dialog, trigger) {
  lastDialogTrigger = trigger;
  dialog.showModal();
  dialog.querySelector("input, select, button")?.focus();
}

function closeDialog(dialog) {
  dialog.close();
  lastDialogTrigger?.focus();
}

async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function initializeAdmin() {
  document.querySelector("#admin-open").addEventListener("click", (event) => openDialog(loginDialog, event.currentTarget));
  document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
  [loginDialog, adminDialog].forEach((dialog) => {
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog(dialog);
      } else trapFocus(event, dialog);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = loginForm.querySelector("#admin-password");
    const error = loginForm.querySelector("#login-error");
    const submit = loginForm.querySelector('[type="submit"]');
    submit.dataset.loading = "true";
    submit.disabled = true;
    error.textContent = "";
    password.setAttribute("aria-invalid", "false");
    let authenticated = false;
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash: await hash(password.value) }),
      });
      authenticated = response.ok;
      if (!authenticated) {
        const payload = await response.json().catch(() => ({}));
        error.textContent = response.status === 503
          ? "A autenticação administrativa não está configurada."
          : payload.error || "Senha incorreta";
      }
    } catch {
      error.textContent = "Não foi possível validar o acesso. Tente novamente.";
    } finally {
      submit.dataset.loading = "false";
      submit.disabled = false;
    }
    if (!authenticated) {
      password.setAttribute("aria-invalid", "true");
      password.focus();
      return;
    }
    password.value = "";
    password.setAttribute("aria-invalid", "false");
    error.textContent = "";
    loginDialog.close();
    populateAdmin(activeProfile(), activeMonth());
    adminDialog.showModal();
    adminDialog.querySelector("#admin-profile").focus();
  });
  adminForm.querySelector("#admin-profile").addEventListener("change", () => populateAdmin(adminForm.querySelector("#admin-profile").value, adminForm.querySelector("#admin-month").value));
  adminForm.querySelector("#admin-month").addEventListener("change", () => populateAdmin(adminForm.querySelector("#admin-profile").value, adminForm.querySelector("#admin-month").value));
  adminForm.addEventListener("submit", saveAdmin);
}

function populateAdmin(profile, monthKey) {
  const safeMonth = validMonthKey(monthKey) ? monthKey : activeMonth(profile);
  const ctx = context(profile, safeMonth);
  adminForm.querySelector("#admin-profile").value = profile;
  adminForm.querySelector("#admin-month").innerHTML = monthOptions(safeMonth);
  adminForm.querySelector("#admin-month").value = safeMonth;
  adminForm.querySelector("#admin-financial-goal").value = ctx.monthState.financialGoal;
  adminForm.querySelector("#admin-financial-date").value = ctx.monthState.financialDeadline;
  adminForm.querySelector("#admin-academic-goal").value = ctx.semesterState.academicGoal;
  adminForm.querySelector("#admin-academic-date").value = ctx.semesterState.academicDeadline;
  adminForm.querySelector("#admin-salary").value = formatCurrency(ctx.monthState.salary).replace(/^R\$\s?/, "");
  adminForm.querySelector("#admin-salary-field").hidden = profile !== "gerente";
  const rates = adminForm.querySelector("#admin-rates");
  const description = adminForm.querySelector("#admin-rates-description");
  if (profile === "consultor") {
    description.textContent = "Estrutura vertical: cada modalidade reúne todas as faixas da planilha de política.";
    rates.innerHTML = MODALITIES.map((modality) => `<section class="admin-rate-section"><h3>${escapeHtml(modality.label)}</h3><div class="admin-rate-fields">${CONSULTANT_TIERS.map((tier, index) => `<div class="field"><label for="rate-${modality.id}-${index}">${tier.label}</label><input id="rate-${modality.id}-${index}" type="text" inputmode="decimal" value="${state.config.consultantRates[modality.id][index]}" data-consultant-rate="${modality.id}:${index}"></div>`).join("")}</div></section>`).join("");
  } else {
    description.textContent = "Percentual do salário-base aplicado conforme o menor atingimento entre as duas metas.";
    rates.innerHTML = state.config.managerTiers.map((tier, index) => `<section class="admin-rate-section"><h3>${escapeHtml(tier.label)}</h3><div class="field"><label for="manager-tier-${index}">Percentual do salário</label><input id="manager-tier-${index}" type="text" inputmode="decimal" value="${formatNumber(tier.multiplier * 100)}" data-manager-rate="${index}"><p class="field-help">Percentual aplicado ao salário-base.</p></div></section>`).join("");
  }
}

function setAdminError(id, validation) {
  const input = adminForm.querySelector(`#${id}`);
  const error = adminForm.querySelector(`#${id}-error`);
  input.setAttribute("aria-invalid", String(!validation.valid));
  error.textContent = validation.message;
}

function saveAdmin(event) {
  event.preventDefault();
  const profile = adminForm.querySelector("#admin-profile").value;
  const monthKey = adminForm.querySelector("#admin-month").value;
  const ctx = context(profile, monthKey);
  const financialGoal = validateGoal(adminForm.querySelector("#admin-financial-goal").value);
  const academicGoal = validateGoal(adminForm.querySelector("#admin-academic-goal").value);
  const financialDate = validateFinancialDate(adminForm.querySelector("#admin-financial-date").value, monthKey);
  const academicDate = validateAcademicDate(adminForm.querySelector("#admin-academic-date").value, monthKey);
  setAdminError("admin-financial-goal", financialGoal);
  setAdminError("admin-academic-goal", academicGoal);
  setAdminError("admin-financial-date", financialDate);
  setAdminError("admin-academic-date", academicDate);
  if (![financialGoal, academicGoal, financialDate, academicDate].every((item) => item.valid)) {
    adminForm.querySelector("#admin-status").textContent = "Corrija os campos destacados. Nenhum parâmetro foi alterado.";
    adminForm.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  ctx.monthState.financialGoal = financialGoal.value;
  ctx.monthState.financialDeadline = adminForm.querySelector("#admin-financial-date").value;
  ctx.semesterState.academicGoal = academicGoal.value;
  ctx.semesterState.academicDeadline = adminForm.querySelector("#admin-academic-date").value;
  if (profile === "gerente") {
    ctx.monthState.salary = Math.max(0, parseMoney(adminForm.querySelector("#admin-salary").value));
    adminForm.querySelectorAll("[data-manager-rate]").forEach((input) => {
      state.config.managerTiers[Number(input.dataset.managerRate)].multiplier = Math.max(0, parseMoney(input.value) / 100);
    });
  } else {
    adminForm.querySelectorAll("[data-consultant-rate]").forEach((input) => {
      const [modality, index] = input.dataset.consultantRate.split(":");
      state.config.consultantRates[modality][Number(index)] = Math.max(0, parseMoney(input.value));
    });
  }
  ctx.monthState.snapshot = { consultantRates: structuredClone(state.config.consultantRates), managerTiers: structuredClone(state.config.managerTiers) };
  persist();
  adminForm.querySelector("#admin-status").textContent = "Parâmetros salvos.";
  showToast("Parâmetros administrativos atualizados.");
  render();
}

document.querySelectorAll("[data-nav-route]").forEach((link) => link.addEventListener("click", handleInternalLink));
menuToggle.addEventListener("click", () => (sidebar.dataset.open === "true" ? closeMenu(true) : openMenu()));
menuOverlay.addEventListener("click", () => closeMenu(true));
sidebar.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu(true);
  } else if (sidebar.dataset.open === "true") trapFocus(event, sidebar);
});
window.addEventListener("popstate", () => {
  route = normalizeRoute(location.pathname);
  render();
});
initializeAdmin();
if (location.pathname === "/" || !Object.values(ROUTES).includes(`/${location.pathname.split("/").filter(Boolean)[0] || ""}`)) updateUrl(ROUTES.projection, { perfil: activeProfile(), mes: activeMonth() }, { replace: true });
render();
