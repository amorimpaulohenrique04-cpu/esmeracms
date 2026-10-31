# Correção: publicação de mídia no popup de novo produto (2026-10-30)

## Causa confirmada

- `POST /api/admin-product-media` criava mídias sem `_status: published`.
- A coleção `media` tem `versions.drafts = true`, portanto esses registros ficavam em `draft`.
- O popup anexava o ID de mídia ao produto e mostrava "Imagem adicionada à galeria".
- `save-and-publish` aplicava o contrato público, corretamente bloqueando `gallery.0.image` com `storefront.media.unpublished` e HTTP 422.
- O editor completo já publicava a mídia pelo `/api/media`, com `_status: published`.

## Alterações implementadas

- [x] O endpoint exclusivo do popup publica a mídia na criação (`_status: published`, `draft: false`).
- [x] O endpoint recusa reportar upload bem-sucedido se o status retornado não for `published`.
- [x] O componente do popup valida o status antes de anexar à galeria.
- [x] A publicação do produto fica bloqueada enquanto o upload/reordenação da galeria estiver em andamento.
- [x] O popup trata distintamente `published`, `published_but_unverified`, `published_but_incompatible` e `publish_reverted`.
- [x] O validador `storefront.media.unpublished` permanece intacto.
- [x] Foram adicionados testes unitários positivos e negativos para o uploader.
- [x] Foram adicionados testes E2E para upload de 1 e 2 imagens e bloqueio deliberado de mídia draft.
- [x] Foi criado um utilitário de recuperação com modo somente leitura por padrão e escopo limitado aos produtos selecionados.

## Recuperação das mídias anteriores

Evidência de produção no momento da investigação:

| Produto | ID | Mídias em draft |
|---|---:|---|
| Porta Salmos | 778 | 1205, 1206, 1207 |
| Jogo da Velha | 780 | 1212, 1213 |
| mmm (teste) | 781 | 1214 |

**Atenção:** a recuperação somente publica as mídias — **não publica automaticamente os produtos** (especialmente o produto de teste). O script só altera os IDs referenciados nos produtos informados, preserva IDs/galerias e usa a API versionada do Payload, não SQL direto.

Com a conexão e as variáveis de ambiente corretas para o backend, conferir primeiro:

```bash
pnpm exec tsx src/scripts/repair-product-popup-media.ts --product-ids=778,780,781 --dry-run
```

Revisar o relatório, as imagens e os produtos. Somente após conferir o alvo de produção e aceitar a operação:

```bash
pnpm exec tsx src/scripts/repair-product-popup-media.ts --product-ids=778,780,781 --apply
```

O script requer `DATABASE_URL` e configuração Payload/armazenamento da instância correta. Em caso de mídia inválida, interrompe a recuperação desse item, registra a pendência e retorna código de erro. Após a recuperação, publicar apenas os produtos desejados pelo fluxo coordenado do CMS. Não executar `UPDATE` direto nas tabelas `media` ou `_media_v`.

## Checklist de validação antes de colocar em produção

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm generate:types`
- [ ] `pnpm generate:importmap`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint --max-warnings=0`
- [ ] `pnpm test:int` (inclui os testes unitários novos)
- [ ] `pnpm build`
- [ ] `pnpm test:e2e` (inclui os três cenários novos)
- [ ] Revisar o PR e integrar à `main` após todos os checks
- [ ] Verificar deploy Vercel de produção e commit exato
- [ ] Verificar upload real no popup com uma e duas imagens
- [ ] Confirmar mídia `published` no Payload, na revisão e no catálogo público
- [ ] Confirmar arquivo acessível e sem corte indevido no storefront
- [ ] Fazer dry-run de recuperação, revisar IDs e autorizar aplicação
- [ ] Aplicar recuperação e verificar status das mídias anteriores
- [ ] Publicar apenas os produtos aprovados; não publicar produtos de teste
- [ ] Verificar logs e ausência de novos `storefront.media.unpublished` para uploads pelo popup

**Status de implantação:** este PR não representa autorização para alterar dados de produção ou promover um deploy. Até o checklist ser concluído, manter as etapas de implantação/recuperação pendentes.
