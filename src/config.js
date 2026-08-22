export const ROUTES = Object.freeze({
  projection: "/projecao",
  results: "/resultados",
  opportunities: "/oportunidades",
  notes: "/anotacoes",
});

export const PROFILE_LABELS = Object.freeze({
  consultor: "Consultor",
  gerente: "Gerente",
});

export const MODALITIES = Object.freeze([
  { id: "med", legacyId: "medVetOdonto", label: "Med. Veterinária/Odonto" },
  { id: "estrela", legacyId: "presencialEstrela", label: "Presencial — Cursos Estrela" },
  { id: "outros", legacyId: "presencialOutros", label: "Presencial — Outros" },
  { id: "semi", legacyId: "semipresencial", label: "Semipresencial" },
  { id: "ead", legacyId: "ead", label: "EAD — inclui Ao Vivo e Flex" },
]);

export const CONSULTANT_TIERS = Object.freeze([
  { min: 0, label: "0%–49,99%" },
  { min: 0.5, label: "50%–79,99%" },
  { min: 0.8, label: "80%–99,99%" },
  { min: 1, label: "100%–119,99%" },
  { min: 1.2, label: "120%–149,99%" },
  { min: 1.5, label: "150%–199,99%" },
  { min: 2, label: "200%+" },
]);

export const DEFAULT_CONSULTANT_RATES = Object.freeze({
  med: [50, 100, 140, 200, 240, 280, 320],
  estrela: [23, 45, 63, 90, 108, 126, 144],
  outros: [20, 40, 56, 80, 96, 112, 128],
  semi: [15, 30, 42, 60, 72, 84, 96],
  ead: [9, 18, 25, 35, 42, 49, 56],
});

export const DEFAULT_MANAGER_TIERS = Object.freeze([
  { min: 0, label: "0%–79,99%", multiplier: 0 },
  { min: 0.8, label: "80%–89,99%", multiplier: 0.1 },
  { min: 0.9, label: "90%–99,99%", multiplier: 0.25 },
  { min: 1, label: "100%–109,99%", multiplier: 0.3 },
  { min: 1.1, label: "110%+", multiplier: 0.35 },
]);

export const DEFAULT_PRODUCTION = Object.freeze({
  consultor: {
    med: { inscritos: 6, matfin: 4, matacad: 3 },
    estrela: { inscritos: 4, matfin: 2, matacad: 1 },
    outros: { inscritos: 8, matfin: 5, matacad: 4 },
    semi: { inscritos: 10, matfin: 6, matacad: 5 },
    ead: { inscritos: 18, matfin: 10, matacad: 8 },
  },
  gerente: {
    med: { inscritos: 9, matfin: 6, matacad: 5 },
    estrela: { inscritos: 7, matfin: 4, matacad: 3 },
    outros: { inscritos: 12, matfin: 8, matacad: 7 },
    semi: { inscritos: 16, matfin: 10, matacad: 8 },
    ead: { inscritos: 28, matfin: 18, matacad: 15 },
  },
});

export const DEFAULT_GOALS = Object.freeze({
  consultor: { financial: 30, academic: 60, salary: 0 },
  gerente: { financial: 45, academic: 90, salary: 5000 },
});
