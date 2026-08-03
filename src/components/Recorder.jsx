import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { C } from "../lib/util.js";

/* Gravador de reunião presencial: MediaRecorder captura o áudio do microfone
   enquanto o reconhecimento de voz do navegador (Chrome/Edge) transcreve ao
   vivo em pt-BR. Tudo gratuito e local — nada sai do navegador até o upload. */
export default function Recorder({ onFinish, busy }) {
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [live, setLive] = useState("");
  const [err, setErr] = useState(null);

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const srRef = useRef(null);
  const finalRef = useRef("");
  const recRef = useRef(false);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const wakeRef = useRef(null);
  const startTsRef = useRef(0);

  const supported = typeof window !== "undefined" && navigator.mediaDevices && window.MediaRecorder;
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      finalRef.current = "";
      setLive(""); setSecs(0);
      const mime = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.start(2000);
      mrRef.current = mr;

      if (SR) {
        const sr = new SR();
        sr.lang = "pt-BR";
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalRef.current += r[0].transcript.trim() + "\n";
            else interim += r[0].transcript;
          }
          setLive((finalRef.current.replace(/\n/g, " ") + " " + interim).trim().slice(-150));
        };
        // o Chrome para sozinho em silêncios — religa enquanto estiver gravando
        sr.onend = () => { if (recRef.current) { try { sr.start(); } catch (e2) {} } };
        sr.onerror = () => {};
        try { sr.start(); } catch (e2) {}
        srRef.current = sr;
      }
      try { wakeRef.current = await navigator.wakeLock?.request("screen"); } catch (e2) {}
      startTsRef.current = Date.now();
      recRef.current = true;
      setRec(true);
      timerRef.current = setInterval(() => setSecs(Math.round((Date.now() - startTsRef.current) / 1000)), 1000);
    } catch (e) {
      setErr("Não consegui acessar o microfone — permita o acesso nas configurações do navegador.");
    }
  };

  const stop = (cancel) => {
    recRef.current = false;
    setRec(false);
    clearInterval(timerRef.current);
    try { srRef.current && srRef.current.stop(); } catch (e) {}
    try { wakeRef.current && wakeRef.current.release(); } catch (e) {}
    const mr = mrRef.current;
    if (!mr) return;
    mr.onstop = () => {
      try { streamRef.current && streamRef.current.getTracks().forEach((t) => t.stop()); } catch (e) {}
      if (cancel) return;
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      const durationSec = Math.round((Date.now() - startTsRef.current) / 1000);
      onFinish({ blob, transcript: finalRef.current.trim(), durationSec });
    };
    try { mr.stop(); } catch (e) {}
  };

  useEffect(() => () => { if (recRef.current) stop(true); }, []); // eslint-disable-line

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!supported) return null;

  if (busy) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ background: "#E2E5E9", color: "#4B5563" }}>
        <Loader2 size={14} className="animate-spin" /> salvando gravação…
      </span>
    );
  }

  if (!rec) {
    return (
      <>
        <button onClick={start}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: "#FBE9E7", color: "#A32D2D" }}
          title={SR ? "Gravar a reunião com transcrição automática (pt-BR)" : "Gravar o áudio da reunião (transcrição automática indisponível neste navegador)"}>
          <Mic size={14} /> Gravar
        </button>
        {err && <span className="text-xs" style={{ color: C.danger }}>{err}</span>}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm min-w-0" style={{ background: "#A32D2D", color: "#fff" }}>
      <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: "#fff" }} />
      <b className="shrink-0">{fmt(secs)}</b>
      {live && <span className="text-xs opacity-80 truncate hidden sm:inline" style={{ maxWidth: 240 }}>{live}</span>}
      {!SR && <span className="text-xs opacity-80 hidden sm:inline">gravando áudio (sem transcrição neste navegador)</span>}
      <button onClick={() => stop(false)} className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold shrink-0" style={{ background: "#fff", color: "#A32D2D" }}>
        <Square size={11} /> Parar
      </button>
      <button onClick={() => { if (window.confirm("Descartar a gravação?")) stop(true); }}
        className="text-xs underline opacity-80 shrink-0">cancelar</button>
    </div>
  );
}
