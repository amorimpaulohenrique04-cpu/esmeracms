# Esméra CMS — Etapa 19 · Segurança, produção e LGPD

## Access Control

Papéis continuam sendo:

- Admin;
- Editor;
- Comercial.

As verificações são aplicadas em quatro camadas:

1. navegação e views;
2. endpoints customizados;
3. Collections, campos e Local API;
4. Jobs Queue.

Jobs só podem ser enfileirados e cancelados por Admin. Execução aceita Admin ou cron autenticado por `CRON_SECRET`. Clientes só podem ser excluídos diretamente por Admin. Campos internos de solicitação, retenção e restrição são protegidos por acesso de campo.

Ocultar um controle nunca é considerado autorização.

## Produção

- `postgresAdapter.push` fica desativado quando `NODE_ENV=production`;
- migrations usam `pnpm migrate` e `pnpm migrate:status`;
- `PAYLOAD_SECRET` com menos de 24 caracteres interrompe a configuração em produção;
- `pnpm db:backup -- <arquivo.dump>` cria backup custom sem expor senha na linha de comando;
- `pnpm db:restore:test -- <arquivo.dump>` exige banco isolado e executa `pg_restore --clean --if-exists --exit-on-error`;
- `pnpm validate:production` valida banco, HTTPS, secrets, restore de teste e contrato de armazenamento remoto;
- logs de performance não carregam PII.

## Armazenamento remoto

O repositório não declara um adapter S3/R2 como ativo sem pacote, credenciais e teste real. O gate de produção exige:

- `MEDIA_STORAGE_DRIVER=s3` ou `r2`;
- bucket, região, access key e secret;
- endpoint para R2;
- `MEDIA_STORAGE_ADAPTER_READY=true` somente após o adapter remoto ser instalado, conectado à Collection Media e validado no ambiente de deploy.

Enquanto isso não ocorrer, `validate:production` reprova. Isso impede que armazenamento local seja promovido silenciosamente para produção.

## LGPD

A Collection Customers registra:

- consentimento de marketing;
- data de concessão;
- data de retirada;
- status da solicitação;
- abertura e conclusão;
- revisão de retenção;
- restrição de tratamento;
- observações de privacidade.

O hook de domínio gera timestamps no servidor.

O workspace `/admin/privacy` fornece:

- consulta e filtros;
- portabilidade em JSON autenticado;
- concessão e retirada de consentimento;
- solicitação de exclusão;
- análise administrativa;
- anonimização quando aplicável.

Anonimização preserva vínculos transacionais e remove dados identificáveis. Ela é bloqueada enquanto existirem oportunidades, casos de pós-venda ou Tasks abertas. O bloqueio e a conclusão ficam registrados. Não há inferência de dado sensível.

## Retenção

Abertura de solicitação define revisão em 30 dias e restringe tratamento. A decisão final deve considerar obrigações fiscais, contábeis, contratuais e defesa de direitos. Exclusão física não é automática; quando a retenção ainda é necessária, aplica-se restrição ou anonimização compatível.

## Validação

- testes do ciclo de consentimento e solicitação;
- E2E de autorização Editor/Comercial/Admin;
- exportação autenticada;
- endpoint de performance Admin-only;
- build e testes completos antes de integração.
