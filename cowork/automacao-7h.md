# Ajuste da automação das 7h (Cowork)

A partir da Sessão 5, a fonte de dados oficial do Planner é o arquivo
**`planner-dados.json`** na raiz do OneDrive (antes a automação lia o espelho
`planner-gui-finamob.json`, que deixa de existir).

## O que mudar na tarefa existente

Na sua tarefa do Cowork das 7h, troque a instrução de leitura para algo assim:

---

Leia no meu OneDrive (raiz do drive do usuário) o arquivo `planner-dados.json`.
Ele tem o formato: {"meta": {...}, "bodies": {...}, "tmbKey": "..."}.

O que interessa:
- **Equipe**: `meta.users` — cada pessoa tem `name`, `area`, `phone` (com DDI, ex.: 5511999998888) e `email`.
- **Tarefas abertas**: `meta.tasks` filtrando `done == false` — cada tarefa tem `text` (descrição), `userName` (responsável), `date` (prazo DD/MM/AAAA ou null), `important` (⭐) e `noteTitle`/`nbName` (origem).
- **Chave TextMeBot**: campo `tmbKey` na raiz do arquivo.

Com isso, monte e dispare o relatório diário exatamente como a tarefa já fazia
(bom dia individual por WhatsApp via TexteMeBot: `https://api.textmebot.com/send.php?recipient=%2B<phone>&apikey=<tmbKey>&text=<mensagem urlencoded>`),
listando para cada pessoa as tarefas dela vencidas até hoje e sem prazo.

---

## Observação

O app também tem o próprio disparo manual (Meu dia → "Enviar agora") e o banner
das 7h na primeira abertura do dia — a automação do Cowork é a garantia de que o
relatório sai mesmo se ninguém abrir o app.
