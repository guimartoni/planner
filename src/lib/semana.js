import { dateKeyBR, todayBR } from "./util.js";

/* As atividades da MIA são programadas por SEMANA, não por dia. Guardamos
   sempre a segunda-feira da semana (DD/MM/AAAA) e mostramos "semana 17/08". */

const paraData = (br) => {
  const m = (br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
};
const paraBR = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/* Qualquer dia vira a segunda-feira da semana dele. */
export function segundaDa(br) {
  const d = paraData(br);
  if (!d) return "";
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // domingo (0) conta como fim da semana
  return paraBR(d);
}

export function domingoDa(br) {
  const s = paraData(segundaDa(br));
  if (!s) return "";
  s.setDate(s.getDate() + 6);
  return paraBR(s);
}

export const semanaAtual = () => segundaDa(todayBR());
export const rotuloSemana = (br) => (segundaDa(br) ? `semana ${segundaDa(br).slice(0, 5)}` : "sem semana");
export const faixaSemana = (br) => (segundaDa(br) ? `${segundaDa(br).slice(0, 5)} a ${domingoDa(br).slice(0, 5)}` : "");
export const chaveSemana = (br) => dateKeyBR(segundaDa(br)) || "99999999";

/* Concluída · Atraso (a semana já terminou) · A executar */
export function statusDe(a) {
  if (a.concluida) return "concluido";
  if (a.semana && dateKeyBR(domingoDa(a.semana)) < dateKeyBR(todayBR())) return "atraso";
  return "a-executar";
}

export const ehSemanaAtual = (br) => !!br && segundaDa(br) === semanaAtual();
