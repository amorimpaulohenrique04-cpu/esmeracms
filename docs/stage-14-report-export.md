# Esméra CMS — Etapa 14 · Exportação de relatórios

Status: implementação na branch `agent/etapa-14-report-export`, baseada em `feat/admin-operational-rebuild`.

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0, Etapa 14.

## Objetivo

Exportar o recorte exato da tela de Relatórios como um documento verificável, sem tirar screenshot do dashboard.

O PDF é montado por um renderer próprio, alimentado pelo mesmo `ReportingSnapshot` usado na interface. Isso mantém Dashboard, Relatórios e exportação presos ao mesmo contrato semântico.

## Metadados obrigatórios

Cada exportação registra e imprime:

- período inicial e final;
- comparação selecionada;
- responsável;
- origem;
- categoria;
- produto;
- data e hora da geração em `America/Recife`;
- nome e e-mail do usuário gerador;
- versão semântica das métricas;
- horário do snapshot do Reporting Service.

## Renderer PDF

O renderer fica em:

```text
src/server/reporting/export/pdf.ts
```

Ele escreve um PDF real usando objetos, páginas, fontes base, streams de conteúdo e tabela de referências do próprio formato PDF. Não usa DOM, canvas, Playwright, imagem do dashboard ou impressão do navegador.

O documento inclui:

- metadados da exportação;
- filtros;
- KPIs;
- série diária;
- funil;
- origens;
- motivos de perda;
- produtos;
- categorias;
- equipe;
- notas metodológicas.

## Política síncrona e assíncrona

Exportações de até 93 dias são inicialmente elegíveis para geração síncrona. Depois do snapshot, o volume agregado também é medido.

O PDF segue para a Jobs Queue quando:

- o período supera 93 dias; ou
- o snapshot ultrapassa 350 linhas exportáveis.

Relatórios pequenos retornam o PDF na própria resposta HTTP. Relatórios pesados criam um registro `report-exports`, entram na fila `operational` pelo Job `generateReportExport` e ficam disponíveis para download quando o processamento termina.

## Persistência e privacidade

Duas collections técnicas foram adicionadas:

- `report-exports`: auditoria, status, filtros, usuário, contrato semântico, tamanho e erro;
- `report-export-files`: armazenamento privado dos PDFs concluídos pela Jobs Queue.

As collections não aparecem para usuários não administradores no Admin técnico. A leitura e o download exigem usuário comercial ou administrador autenticado.

## API

```text
POST /api/admin-reports/export
GET  /api/admin-reports/export?id=<exportId>
GET  /api/admin-reports/export?id=<exportId>&download=1
```

O `POST` recebe os filtros atuais. Pode responder:

- `200 application/pdf` para exportação síncrona;
- `202 application/json` para exportação enfileirada.

O cliente consulta o status sem desmontar a tela e baixa o arquivo quando o Job passa para `ready`.

## Critérios de aceite

- nenhuma screenshot é usada;
- filtros atuais são capturados da URL;
- o PDF apresenta usuário, período, data/hora e versão semântica;
- exportações pequenas são síncronas;
- exportações pesadas usam Payload Jobs;
- falhas ficam persistidas e visíveis no status;
- o download exige autenticação;
- testes cobrem renderer, política de fila e envio dos filtros atuais pela interface.
