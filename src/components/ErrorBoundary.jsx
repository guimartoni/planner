import { Component } from "react";

/* Rede de proteção: se qualquer tela quebrar, em vez de página branca
   aparece uma mensagem com botão de recarregar. O erro fica guardado em
   localStorage ("planner-ultimo-erro") para diagnóstico. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    try {
      console.error("Erro no app:", err, info);
      localStorage.setItem("planner-ultimo-erro", JSON.stringify({
        quando: new Date().toISOString(),
        erro: String((err && err.stack) || err),
        onde: (info && info.componentStack) || "",
      }));
    } catch (e) {}
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
        background: "#EDEFF2", fontFamily: "system-ui, sans-serif",
        padding: 24, textAlign: "center",
      }}>
        <p style={{ fontSize: 28, margin: 0 }}>😕</p>
        <p style={{ fontSize: 15, color: "#374151", margin: 0 }}>
          Ops — algo deu errado ao abrir esta tela.
        </p>
        <button onClick={() => location.reload()} style={{
          padding: "10px 20px", borderRadius: 10, border: "none",
          background: "#1E6B4F", color: "#fff", fontSize: 14,
          fontWeight: 600, cursor: "pointer",
        }}>
          Recarregar o app
        </button>
        <p style={{ fontSize: 11, color: "#9CA3AF", maxWidth: 560, overflowWrap: "anywhere", whiteSpace: "pre-wrap", textAlign: "left" }}>
          {String((this.state.err && this.state.err.stack) || this.state.err)
            .split("\n").slice(0, 4).join("\n")}
        </p>
      </div>
    );
  }
}
