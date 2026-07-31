/* Tokens visuais e utilitários de data — portados do app de referência */
export const C = {
  ink: "#141A26",
  inkSoft: "#1E2736",
  appBg: "#EDEFF2",
  paper: "#FBFBF8",
  line: "#D9DDE3",
  stamp: "#1E6B4F",
  stampSoft: "#E4F1EB",
  mention: "#4338CA",
  mentionSoft: "#E7E7FB",
  date: "#B45309",
  dateSoft: "#FBEEDB",
  danger: "#B3372F",
};

export const USER_COLORS = ["#4338CA", "#1E6B4F", "#B45309", "#9D2960", "#0E6E8C", "#5B4A9E", "#8A5A00", "#2E6BB0"];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const todayBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dateKeyBR = (d) => (d ? d.split("/").reverse().join("") : null);

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const monthLabel = (d = new Date()) => `${MESES[d.getMonth()]} ${d.getFullYear()}`;

export const plusDaysBR = (dateStr, n) => {
  let d;
  const m2 = (dateStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) d = new Date(+m2[3], +m2[2] - 1, +m2[1]);
  else d = new Date();
  d.setDate(d.getDate() + n);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
