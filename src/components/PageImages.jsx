import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { C } from "../lib/util.js";
import { readFileAsObjectUrl } from "../onedrive.js";

/* Imagens da página: os arquivos moram em /planner-imagens no OneDrive;
   no corpo da página fica só a referência {id, ext, w} (w = largura em %). */

export const imgPath = (im) => `/planner-imagens/${im.id}.${im.ext || "jpg"}`;

/* Reduz a imagem (máx. 1600px, JPEG 85%) para subir rápido e não pesar o OneDrive. */
export async function prepareImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 400000) {
      return { blob: file, ext: file.type === "image/png" ? "png" : "jpg", type: file.type || "image/jpeg" };
    }
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * scale);
    cv.height = Math.round(bmp.height * scale);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    return { blob: blob || file, ext: "jpg", type: "image/jpeg" };
  } catch (e) {
    return { blob: file, ext: "jpg", type: file.type || "image/jpeg" };
  }
}

/* URLs locais já baixadas nesta sessão, para não baixar de novo a cada abertura */
const urlCache = {};

function CloudImg({ im }) {
  const [url, setUrl] = useState(urlCache[im.id] || null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (urlCache[im.id]) { setUrl(urlCache[im.id]); return; }
    let on = true;
    readFileAsObjectUrl(imgPath(im))
      .then((u) => {
        if (!u) { if (on) setErr(true); return; }
        urlCache[im.id] = u;
        if (on) setUrl(u);
      })
      .catch(() => { if (on) setErr(true); });
    return () => { on = false; };
  }, [im.id]);
  if (err) {
    return (
      <div className="rounded-lg border flex items-center justify-center text-xs px-3 py-6"
        style={{ borderColor: C.line, color: "#9CA3AF", background: "#fff" }}>
        imagem indisponível
      </div>
    );
  }
  if (!url) {
    return (
      <div className="rounded-lg border flex items-center justify-center py-8" style={{ borderColor: C.line, background: "#fff" }}>
        <Loader2 size={16} className="animate-spin" style={{ color: "#9CA3AF" }} />
      </div>
    );
  }
  return (
    <img src={url} alt="" onClick={() => window.open(url, "_blank")}
      className="rounded-lg border block cursor-zoom-in"
      style={{ borderColor: C.line, width: "100%", height: "auto" }} />
  );
}

const SIZES = [["P", 30], ["M", 55], ["G", 100]];

export default function PageImages({ images, readOnly, onResize, onRemove, busy }) {
  if (!busy && (!images || !images.length)) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>
        🖼 Imagens{images && images.length ? ` (${images.length})` : ""}
        {!readOnly && <span className="normal-case font-normal tracking-normal ml-2" style={{ color: "#B0B5BC" }}>cole (Ctrl+V), arraste ou use o botão 📷 · P/M/G muda o tamanho</span>}
      </p>
      <div className="flex flex-wrap gap-3 items-start">
        {(images || []).map((im) => (
          <div key={im.id} className="group relative" style={{ width: `${im.w || 55}%`, maxWidth: "100%", minWidth: 120 }}>
            <CloudImg im={im} />
            {!readOnly && (
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-80 md:opacity-0 md:group-hover:opacity-100">
                {SIZES.map(([label, w]) => (
                  <button key={label} onClick={() => onResize(im.id, w)} title={`Tamanho ${label}`}
                    className="w-6 h-6 rounded text-xs font-bold shadow"
                    style={(im.w || 55) === w ? { background: C.stamp, color: "#fff" } : { background: "rgba(255,255,255,.92)", color: "#374151" }}>
                    {label}
                  </button>
                ))}
                <button onClick={() => onRemove(im.id)} title="Remover imagem"
                  className="w-6 h-6 rounded flex items-center justify-center shadow"
                  style={{ background: "rgba(255,255,255,.92)", color: C.danger }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="rounded-lg border flex items-center gap-2 px-3 py-2 text-xs" style={{ borderColor: C.line, color: "#6B7280", background: "#fff" }}>
            <Loader2 size={14} className="animate-spin" /> enviando imagem…
          </div>
        )}
      </div>
    </div>
  );
}
