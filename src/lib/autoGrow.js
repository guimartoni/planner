import { useEffect, useLayoutEffect } from "react";

/* Faz uma caixa de texto crescer junto com o que foi escrito, sem rolagem interna.

   modo "altura" — a caixa fica exatamente do tamanho do texto (blocos de texto,
   comentários e páginas livres).
   modo "minimo" — grava o tamanho do texto como altura MÍNIMA e devolve a altura
   ao flex, para que todas as células da mesma linha da tabela fiquem do tamanho
   da mais alta (a linha continua parecendo uma linha).

   Recalcula ao mudar o texto e quando a janela muda de largura (o texto reparte
   em outras linhas); com `sempre`, recalcula em toda renderização — usar quando a
   caixa pode aparecer na tela sem que o texto tenha mudado. */
export function useAutoGrow(ref, value, { modo = "altura", sempre = false } = {}) {
  const ajustar = () => {
    const ta = ref.current;
    if (!ta) return;
    const alturaAntes = ta.style.height;
    const minimoAntes = ta.style.minHeight;
    if (modo === "minimo") {
      // Sem isso a célula mede a altura da LINHA (o flex já a esticou) e nunca
      // encolheria de volta quando o texto diminui.
      ta.style.alignSelf = "flex-start";
      ta.style.minHeight = "0px";
    }
    ta.style.height = "auto";
    const alvo = ta.scrollHeight;
    if (modo === "minimo") ta.style.alignSelf = "";
    if (alvo <= 0) {
      // Caixa fora da tela (aba escondida) mede zero — deixa como estava.
      ta.style.height = alturaAntes;
      ta.style.minHeight = minimoAntes;
      return;
    }
    if (modo === "minimo") {
      ta.style.minHeight = `${alvo}px`;
      ta.style.height = "";
    } else {
      ta.style.height = `${alvo}px`;
    }
    // Conferência: alguns navegadores devolvem a medida arredondada para baixo e
    // sobra um fiapo de texto escondido — completa a diferença que ficou.
    const sobra = ta.scrollHeight - ta.clientHeight;
    if (sobra > 0) {
      if (modo === "minimo") ta.style.minHeight = `${alvo + sobra}px`;
      else ta.style.height = `${alvo + sobra}px`;
    }
  };

  useLayoutEffect(ajustar, sempre ? undefined : [value, modo]); // eslint-disable-line
  useEffect(() => {
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []); // eslint-disable-line
}
