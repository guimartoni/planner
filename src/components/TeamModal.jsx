import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { C } from "../lib/util.js";
import { getAnthropicKey, setAnthropicKey } from "../ia.js";
import Avatar from "./Avatar.jsx";

export default function TeamModal({ users, me, tmbKey, onSaveKey, onExport, onImport, onClose, onAdd, onUpdate, onRemove, onSwitch, buildLabel }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [cfg, setCfg] = useState(null); // {id, name, area, phone, email}
  const [aKey, setAKey] = useState(getAnthropicKey());
  const [aKeySaved, setAKeySaved] = useState(false);
  const [tKey, setTKey] = useState(tmbKey || "");
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.5)" }}>
      <div className="w-full max-w-sm rounded-2xl p-5 max-h-full overflow-y-auto" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: "#1F2937" }}>Equipe cadastrada</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-1.5 mb-4 max-h-72 overflow-y-auto">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.line }}>
              <div className="flex items-center gap-2">
                <Avatar user={u} />
                <span className="flex-1 truncate">{u.name}{me?.id === u.id ? " (você)" : ""}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{u.area}</span>
                <button onClick={() => setCfg(cfg && cfg.id === u.id ? null : { id: u.id, name: u.name, area: u.area || "", phone: u.phone || "", email: u.email || "" })}
                  className="text-xs px-2 py-1 rounded-lg shrink-0"
                  style={u.phone ? { background: "#E4F1EB", color: C.stamp } : { background: "#E2E5E9", color: "#4B5563" }}>
                  {u.phone ? "✓ Editar" : "Editar"}
                </button>
                {me?.id !== u.id && (
                  <button onClick={() => onRemove(u.id)} style={{ color: C.danger }}><Trash2 size={13} /></button>
                )}
              </div>
              {cfg && cfg.id === u.id && (
                <div className="mt-2 pt-2 border-t flex flex-col gap-1.5" style={{ borderColor: C.line }}>
                  <input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })}
                    placeholder="Nome completo"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  <input value={cfg.area} onChange={(e) => setCfg({ ...cfg, area: e.target.value })}
                    placeholder="Área (ex.: Comercial)"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  <input value={cfg.phone} onChange={(e) => setCfg({ ...cfg, phone: e.target.value })}
                    placeholder="Telefone com DDI (ex.: 5511999998888)" inputMode="numeric"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  <input value={cfg.email} onChange={(e) => setCfg({ ...cfg, email: e.target.value })}
                    placeholder="E-mail do trabalho (ex.: ana@empresa.com.br)" inputMode="email"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  {cfg.name.trim() !== u.name && (
                    <p className="text-xs" style={{ color: C.date }}>
                      Atenção: ao renomear, as menções @{u.name} já escritas nas páginas antigas deixam de casar com o novo nome (as tarefas existentes serão atualizadas, mas edite as páginas se quiser manter o vínculo).
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (!cfg.name.trim()) return;
                      onUpdate(u.id, { name: cfg.name.trim(), area: cfg.area.trim() || "Geral", phone: cfg.phone.replace(/\D/g, ""), email: cfg.email.trim().toLowerCase() });
                      setCfg(null);
                    }}
                    className="rounded-lg py-1.5 text-xs font-medium text-white" style={{ background: C.stamp }}>
                    Salvar
                  </button>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && <p className="text-xs" style={{ color: "#9CA3AF" }}>Ninguém cadastrado ainda.</p>}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Envio do relatório diário (TextMeBot)</p>
        <div className="flex flex-col gap-1.5 mb-3 rounded-lg border p-2" style={{ borderColor: C.line, background: "#F5F6F8" }}>
          <p className="text-xs" style={{ color: "#6B7280" }}>
            O relatório é disparado do WhatsApp da empresa para todos com telefone cadastrado. Obtenha a chave conectando o número em{" "}
            <a href="https://textmebot.com/" target="_blank" rel="noreferrer" className="underline" style={{ color: C.stamp }}>textmebot.com</a>
            {" "}(use um número secundário).
          </p>
          <div className="flex gap-1.5">
            <input value={tKey} onChange={(e) => setTKey(e.target.value)} placeholder="Chave (apikey) do TextMeBot"
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
            <button onClick={() => onSaveKey(tKey.trim())}
              className="px-3 rounded-lg text-xs font-medium text-white" style={{ background: C.stamp }}>
              Salvar
            </button>
          </div>
          {tmbKey && <p className="text-xs" style={{ color: C.stamp }}>✓ chave configurada</p>}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>IA instantânea (opcional)</p>
        <div className="flex flex-col gap-1.5 mb-3 rounded-lg border p-2" style={{ borderColor: C.line, background: "#F5F6F8" }}>
          <p className="text-xs" style={{ color: "#6B7280" }}>
            Sem chave, o "Gerar ata" usa a <b>fila de IA</b> (custo zero, pronto em alguns minutos).
            Com uma chave da API Anthropic (console.anthropic.com), a resposta sai em segundos.
            Custo estimado: <b>menos de R$ 0,50 por ata</b>; recomendamos definir um limite mensal (ex.: US$ 5) no painel da Anthropic.
            A chave fica só neste navegador.
          </p>
          <div className="flex gap-1.5">
            <input value={aKey} onChange={(e) => setAKey(e.target.value)} placeholder="sk-ant-… (deixe vazio para usar a fila)"
              type="password"
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
            <button onClick={() => { setAnthropicKey(aKey); setAKeySaved(true); setTimeout(() => setAKeySaved(false), 1500); }}
              className="px-3 rounded-lg text-xs font-medium text-white" style={{ background: C.stamp }}>
              {aKeySaved ? "✓" : "Salvar"}
            </button>
          </div>
          {getAnthropicKey() && <p className="text-xs" style={{ color: C.stamp }}>✓ modo instantâneo ativo neste navegador</p>}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Dados</p>
        <div className="flex gap-1.5 mb-3">
          <button onClick={onExport} className="flex-1 rounded-lg py-1.5 text-xs font-medium border" style={{ borderColor: C.line, color: "#374151", background: "#fff" }}>
            ⬇ Exportar dados
          </button>
          <button onClick={onImport} className="flex-1 rounded-lg py-1.5 text-xs font-medium border" style={{ borderColor: C.line, color: "#374151", background: "#fff" }}>
            ⬆ Importar dados
          </button>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Adicionar pessoa</p>
        <div className="flex flex-col gap-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo"
            className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área"
            className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
          <button
            onClick={() => { if (name.trim()) { onAdd(name.trim(), area.trim()); setName(""); setArea(""); } }}
            className="rounded-lg py-2 text-sm font-medium text-white" style={{ background: C.stamp }}>
            Cadastrar
          </button>
        </div>
        <p className="text-center text-xs mt-3 mb-1" style={{ color: "#B0B5BC" }}>{buildLabel}</p>
        <button onClick={onSwitch} className="w-full text-center text-xs underline" style={{ color: "#6B7280" }}>
          Trocar de usuário neste aparelho
        </button>
      </div>
    </div>
  );
}
