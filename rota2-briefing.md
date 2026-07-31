# Planner - Gui - Finamob — Briefing Técnico (Rota 2)

## Objetivo
Reconstruir o app "Planner - Gui - Finamob" (hoje um artifact React no Claude) como aplicação web própria, com URL eterna, deploy de um comando e custo mensal ZERO — preservando todas as funcionalidades e migrando os dados existentes.

## Arquitetura (decidida — não alterar sem discutir)
- **Frontend:** React + Vite, SPA estática. Tailwind. Identidade visual atual: verde #1E6B4F (stamp), papel #FDFBF4, fonte Georgia p/ títulos.
- **Hospedagem:** GitHub Pages com deploy automático via GitHub Actions no push (URL fixa: usuario.github.io/planner). PWA (manifest + service worker) para instalar no PC e iPhone.
- **Banco de dados = OneDrive do usuário** via Microsoft Graph (MSAL.js no browser, auth code + PKCE):
  - Arquivo único `planner-dados.json` na raiz do OneDrive (mesmo formato do export atual: {meta, bodies, tmbKey}).
  - Leitura no load; gravação com debounce + merge (portar a função mergeMeta do app atual — união por id, lixeira como lápide).
  - Sync multi-aparelho: polling do arquivo (etag/lastModified) a cada 30s + merge.
- **Agenda:** Microsoft Graph /me/calendarView (substitui o conector MCP — mais estável). Cruzar participantes com e-mails da equipe (campo eq).
- **Registro Azure AD:** app registration gratuito (conta Microsoft pessoal/empresa), SPA redirect na URL do Pages, scopes delegados: Files.ReadWrite, Calendars.Read, User.Read, offline_access.
- **IA com custo ZERO (arquitetura de fila via Cowork/Max):**
  - Botões de IA (Gerar ata, Resumo semanal, Pergunte ao acervo, Preencher blocos) gravam um pedido em `planner-ia-fila/pedido-<id>.json` no OneDrive: {tipo, noteId, prompt-payload}.
  - Uma tarefa do Claude Cowork (agendada a cada 30 min em horário comercial + acionável manualmente) processa a fila: lê pedidos, gera a resposta no formato JSON esperado, grava `planner-ia-fila/resposta-<id>.json`, apaga o pedido.
  - O app faz polling da resposta (a cada 10s por até 30 min) e aplica (structured/ata, resumo, etc.). UI mostra "Na fila da IA — pronto em alguns minutos".
  - Campo opcional de chave da API Anthropic (desligado por padrão) para quem quiser resposta em segundos; com teto documentado.
- **WhatsApp:** manter o modelo atual — links TextMeBot (send.php) e wa.me; chave tmbKey nos dados.
- **Automação 7h:** a tarefa do Cowork existente passa a ler `planner-dados.json` (mesmo formato — ajustar só o nome do arquivo no prompt).

## Paridade funcional (checklist — tudo do app atual)
Referência de comportamento: arquivo `referencia/livro-de-atas.jsx` (o app atual completo, ~3500 linhas). Portar:
1. Cadernos (abas) → subtemas → páginas; caderno Diário automático (subtema mensal, página do dia, abre nela).
2. Editor livre com comandos: @responsável (autocomplete), # prazo (atalhos Hoje/Amanhã/+7 + calendário), !subtema (roteia linha), * importante; chips coloridos; barra N/I/S/destaque/lista (marcadores **, _, ~~, ==); colagem normalizada.
3. Tarefas nascem das anotações (reconcileTasks por assinatura, só com responsável); Pendências com filtros pessoa/período, atrasadas destacadas, badge no header, edição inline (+1d/+1sem/data/responsável — reescrevendo a linha de origem), recorrentes (semanal/mensal), relatório filtrado p/ WhatsApp.
4. Templates estruturados v2 (blocos: list, table, sql, metric, check, text; comentários por bloco; SmartTextarea no bloco de texto): FUP Farming, Inbound, Parcerias (definições em FARMING_BLOCKS/INBOUND_BLOCKS/PARCERIAS_BLOCKS no código de referência); criar da semana com data escolhível clonando a anterior; "virou realizada" (promover linhas); painel escuro (FupPanel) com KPIs + deltas + badges; navegação ‹› entre semanas; ata de FUP = painel escuro + ações.
5. Gerar ata (via fila IA): JSON titulo/data/resumo/participantes/pauta/decisoes/acoes; participantes informados no campo; AtaDocument clássico p/ páginas livres.
6. Meu dia: agenda de hoje + minhas pendências + equipe agrupada; botões copiar/WhatsApp; resumo semanal (fila IA); banner 7h → wa.me; painel de envio individual TextMeBot.
7. Busca global (Ctrl+K) + Pergunte ao acervo (fila IA).
8. Equipe: editar nome/área/telefone/e-mail; chave TextMeBot; exportar/importar (mesmo formato); gravação/transcrição de reunião (Web Speech API) e importar áudio/transcrição.
9. Lixeira com restaurar/excluir; mover páginas entre subtemas; espelho p/ automação (o próprio planner-dados.json já cumpre o papel).
10. Proteções: merge em todo save, flush em visibilitychange/pagehide, salvar imediato ao gerar ata.

## Migração de dados (sessão final)
O usuário tem `planner-backup-completo.json` no OneDrive (formato {meta, bodies, tmbKey}). O novo app deve, no primeiro login, detectar esse arquivo e oferecer importação 1-clique → grava como planner-dados.json.

## Roadmap de sessões
- S1: esqueleto (Vite+React+Tailwind), deploy no Pages funcionando, registro Azure guiado, login Microsoft, ler/gravar planner-dados.json.
- S2: núcleo de dados portado (meta/bodies/merge), cadernos/páginas/editor com comandos, tarefas + Pendências.
- S3: templates estruturados + painel FUP + atas (fila IA) + tarefa Cowork da fila.
- S4: Meu dia + agenda Graph + WhatsApp + busca/acervo + resumo semanal.
- S5: PWA/instalação, migração dos dados reais, ajustes finos, aposentadoria do artifact.

## Regras para o Claude Code
- Commits pequenos e descritivos; deploy verificável ao fim de cada sessão.
- Nunca inventar valores de configuração — pedir ao usuário (client id do Azure, nome de usuário GitHub).
- Português nas interfaces e mensagens. Manter nomes de campos do formato de dados atual (compatibilidade com backup e automação 7h).
