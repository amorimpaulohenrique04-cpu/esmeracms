# Esméra CMS — Etapa 18 · Performance medida

## Orçamentos

A implementação declara metas verificáveis em `src/server/performance/index.ts`:

- feedback local percebido: menos de 100 ms;
- navegação quente: menos de 300 ms;
- consulta operacional P95: menos de 250 ms;
- relatório agregado P95: menos de 800 ms.

As metas não são apresentadas como resultado. Cada operação recebe amostras reais e estado `withinBudget`.

## Instrumentação

`findDocs` e `countDocs` medem consultas operacionais da Local API. O Reporting Service registra cada consulta SQL agregada no mesmo registry. O buffer mantém no máximo 200 amostras por operação e calcula P95 deterministicamente.

Os nomes medidos são estáticos, por exemplo `products.find` ou `report.funnel`. Filtros, termos de busca, IDs, nomes, telefones e e-mails não entram em logs nem snapshots.

## Observabilidade

- `/api/admin-performance` exige papel de administrador;
- Admin técnico mostra P95, amostras, orçamento e estado;
- `PERFORMANCE_LOGS=true` registra todas as medições;
- sem a flag, apenas operações acima do orçamento são registradas;
- as amostras são locais ao processo e reiniciam após deploy ou restart.

## Estratégias já aplicadas

- Server Components e Local API para dados iniciais;
- `select` explícito nas consultas operacionais;
- paginação no servidor;
- AbortController na busca global;
- manutenção dos dados anteriores durante refresh de Relatórios;
- ECharts carregado somente na ilha de gráfico;
- ausência de WebSocket e virtualização sem evidência medida;
- cache compartilhado disponível para ilhas cliente.

## Testes

`tests/int/performance.int.spec.ts` valida P95, orçamentos e ausência de dados de entrada no snapshot. O pipeline também executa build, integração e E2E para detectar regressões funcionais decorrentes de otimização.
