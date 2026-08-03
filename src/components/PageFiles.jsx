import { Loader2, Trash2 } from "lucide-react";
import { C } from "../lib/util.js";

/* Arquivos anexados à página: moram em /planner-arquivos no OneDrive;
   no corpo da página fica só a referência {id, name, size}. */

export const filePath = (f) => `/planner-arquivos/${f.id}-${f.name}`;

const ICON = {
  pdf: "📕", doc: "📘", docx: "📘", xls: "📗", xlsx: "📗", csv: "📗",
  ppt: "📙", pptx: "📙", zip: "🗜️", rar: "🗜️", txt: "📄",
  mp3: "🎵", mp4: "🎬", jpg: "🖼️", jpeg: "🖼️", png: "🖼️",
};
const iconOf = (name) => ICON[(name || "").split(".").pop().toLowerCase()] || "📄";

const fmtSize = (n) => {
  if (!n) return "";
  return n >= 1048576
    ? (n / 1048576).toFixed(1).replace(".", ",") + " MB"
    : Math.max(1, Math.round(n / 1024)) + " KB";
};

export default function PageFiles({ files, readOnly, onOpen, onRemove, busy }) {
  if (!busy && (!files || !files.length)) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>
        📎 Arquivos{files && files.length ? ` (${files.length})` : ""}
        {!readOnly && <span className="normal-case font-normal tracking-normal ml-2" style={{ color: "#B0B5BC" }}>toque no arquivo para abrir</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {(files || []).map((f) => (
          <div key={f.id} className="flex items-center gap-2 rounded-lg border pl-3 pr-2 py-2 text-sm max-w-full"
            style={{ borderColor: C.line, background: "#fff" }}>
            <button onClick={() => onOpen && onOpen(f)} className="flex items-center gap-2 min-w-0 text-left" title="Abrir arquivo">
              <span className="shrink-0">{iconOf(f.name)}</span>
              <span className="truncate font-medium" style={{ color: "#1F2937", maxWidth: 220 }}>{f.name}</span>
              <span className="text-xs shrink-0" style={{ color: "#9CA3AF" }}>{fmtSize(f.size)}</span>
            </button>
            {!readOnly && (
              <button onClick={() => onRemove && onRemove(f.id)} className="p-1 shrink-0" title="Remover arquivo" style={{ color: C.danger }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: C.line, color: "#6B7280", background: "#fff" }}>
            <Loader2 size={14} className="animate-spin" /> enviando arquivo…
          </div>
        )}
      </div>
    </div>
  );
}
