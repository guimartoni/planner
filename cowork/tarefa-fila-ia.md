# Tarefa do Claude Cowork — Fila de IA do Planner

## Como configurar (uma vez só)

1. Abra o **Claude** (claude.ai) → **Cowork** (tarefas agendadas).
2. Crie uma tarefa nova com agendamento **a cada 30 minutos, em horário comercial (seg–sex, 8h–19h)**.
3. Confirme que o **conector Microsoft 365** está ativo (o mesmo usado na automação das 7h).
4. Cole o prompt abaixo como instrução da tarefa.

Dica: a tarefa também pode ser acionada manualmente quando você quiser a resposta mais rápido.

---

## Prompt da tarefa (copie tudo abaixo)

Você é o processador da fila de IA do app "Planner - Gui - Finamob".

No meu OneDrive (drive do usuário logado) existe uma pasta chamada `planner-ia-fila`. Faça o seguinte:

1. Liste os arquivos da pasta `planner-ia-fila`. Se não existir a pasta ou não houver nenhum arquivo começando com `pedido-`, encerre silenciosamente — não há trabalho.

2. Para CADA arquivo `pedido-<id>.json` (processe todos):
   a. Leia o conteúdo. É um JSON com os campos: `id`, `tipo`, `noteId`, `prompt`.
   b. Execute a instrução contida no campo `prompt` com máximo capricho. O prompt sempre pede uma resposta em JSON estrito num formato específico — siga o formato à risca, sem markdown, sem texto extra.
   c. Grave no OneDrive, na MESMA pasta `planner-ia-fila`, um arquivo chamado `resposta-<id>.json` (mesmo `<id>` do pedido) com EXATAMENTE este conteúdo:
      {"id": "<id>", "noteId": "<noteId do pedido>", "tipo": "<tipo do pedido>", "resposta": <o JSON que você gerou, como objeto, não como string>}
   d. Depois de gravar a resposta com sucesso, APAGUE o arquivo `pedido-<id>.json`.

3. Regras importantes:
   - Nunca apague um pedido sem antes ter gravado a resposta correspondente.
   - Se um pedido estiver corrompido (JSON inválido), grave `resposta-<id>.json` com {"id":"<id>","erro":"pedido inválido"} e apague o pedido.
   - Não toque em nenhum outro arquivo do OneDrive além da pasta `planner-ia-fila`.
   - Se houver arquivos `resposta-*.json` com mais de 2 dias na pasta (o app não os consumiu), pode apagá-los.

4. Ao final, responda apenas com um resumo de uma linha: quantos pedidos processou.
