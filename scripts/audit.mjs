import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const css = await readFile(resolve(root, "src/styles.css"), "utf8");
const html = await readFile(resolve(root, "index.html"), "utf8");
const config = await readFile(resolve(root, "src/config.js"), "utf8");
const app = await readFile(resolve(root, "src/app.js"), "utf8");
const model = await readFile(resolve(root, "src/model.js"), "utf8");
const store = await readFile(resolve(root, "src/store.js"), "utf8");

assert.doesNotMatch(html, /cdn\.tailwindcss\.com/, "Tailwind CDN não pode existir");
assert.doesNotMatch(css, /#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i, "Cores CSS devem usar tokens em OKLCH");
assert.doesNotMatch(config, /ADMIN_PASSWORD|PASSWORD_HASH|password\s*[:=]\s*["'][^"']+/i, "Credenciais não podem existir no bundle do cliente");
assert.doesNotMatch(app, /ADMIN_PASSWORD_HASH|YDUQS@/i, "Credenciais não podem existir no bundle do cliente");
for (const token of ["background", "foreground", "card", "muted-foreground", "border", "brand-emphasis", "brand-subtle", "success", "warning", "danger"]) {
  assert.match(css, new RegExp(`--${token}:\\s*oklch\\(`), `Token --${token} ausente`);
}
assert.match(css, /input,[\s\S]*font-size:\s*16px/, "Inputs precisam usar 16px");
assert.match(css, /\.button,[\s\S]*min-height:\s*44px/, "Controles precisam ter pelo menos 44px");
assert.doesNotMatch(css, /(?:html|body)\s*{[^}]*min-width:\s*320px/s, "A página não pode impor largura mínima de 320px");
assert.match(css, /select\s*{[^}]*min-width:\s*0[^}]*text-overflow:\s*ellipsis/s, "Selects precisam truncar conteúdo extremo com segurança");
assert.match(css, /\.dialog__panel\s*{[^}]*max-height:\s*calc\(100vh - var\(--space-4\)\)[^}]*display:\s*flex[^}]*flex-direction:\s*column/s, "O painel do modal precisa refluír em alto zoom");
assert.match(css, /\.dialog__body\s*{[^}]*flex:\s*1 1 auto[^}]*overflow-y:\s*auto/s, "O corpo do modal precisa manter rolagem acessível");
assert.match(app, /id="hero-money"[^>]*aria-hidden="true"/, "O count-up visual deve ficar oculto de leitores de tela");
assert.match(app, /id="hero-money-status"[^>]*aria-live="polite"/, "O valor final precisa de uma região estática de anúncio");
assert.match(app, /const activeId = document\.activeElement\?\.id;[\s\S]*restoreFocus\(activeId\)/, "Renders precisam restaurar o foco por ID");
assert.match(app, /monthKey, name: name\.value/, "Anotações precisam registrar a competência mensal");
assert.match(app, /window\.confirm\(/, "Exclusões de anotações precisam de confirmação preventiva");
assert.match(model, /Number\.isFinite\(number\)[\s\S]*Number\.isSafeInteger\(number \* 100\)/, "Valores monetários precisam rejeitar Infinity e centavos inseguros");
assert.match(model, /MAX_QUANTITY = 99_999/, "Quantidades precisam ter limite superior explícito");
assert.match(store, /notesForMonth/, "A visualização de anotações precisa ser isolada por mês");

function luminance([L, C, hue]) {
  const angle = (hue * Math.PI) / 180;
  const a = C * Math.cos(angle);
  const b = C * Math.sin(angle);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((value) => Math.min(1, Math.max(0, value)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const colors = {
  background: [0.19, 0.055, 264],
  foreground: [0.97, 0.012, 230],
  card: [0.23, 0.06, 263],
  mutedForeground: [0.79, 0.04, 238],
  brand: [0.78, 0.13, 203],
  danger: [0.72, 0.18, 25],
  warning: [0.84, 0.15, 86],
  success: [0.78, 0.14, 162],
};

for (const [name, foreground, background] of [
  ["foreground/background", colors.foreground, colors.background],
  ["foreground/card", colors.foreground, colors.card],
  ["muted/background", colors.mutedForeground, colors.background],
  ["muted/card", colors.mutedForeground, colors.card],
  ["brand/card", colors.brand, colors.card],
  ["danger/card", colors.danger, colors.card],
  ["warning/card", colors.warning, colors.card],
  ["success/card", colors.success, colors.card],
]) {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, `${name} tem contraste ${ratio.toFixed(2)}:1`);
  console.log(`${name}: ${ratio.toFixed(2)}:1`);
}

console.log("Auditoria estática de tokens, contraste, tipografia e controles aprovada.");
