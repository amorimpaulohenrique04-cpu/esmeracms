/**
 * Copy editorial — o ÚNICO lugar do backend com texto legível de issue e de erro.
 *
 * Nada aqui participa de decisão: mensagens e sugestões são resolvidas depois que
 * código, severidade, path, aba e âncora já foram determinados. Alterar qualquer
 * string deste arquivo não pode mudar comportamento, e é exatamente isso que o
 * teste ERR-U02 verifica — ele injeta um catálogo alternativo e compara tudo
 * menos `message`/`suggestion`.
 */

import { ISSUE_CODES } from './codes'
import type { IssueParams } from './types'

export type IssueCopyEntry = {
  message: (params: IssueParams) => string
  suggestion?: string
}

export type IssueCopyCatalog = Record<string, IssueCopyEntry>

const quoted = (value: unknown): string => `“${String(value ?? '')}”`
const variant = (params: IssueParams): string => quoted(params.sku || 'sem SKU')

export const issueCopy: IssueCopyCatalog = {
  // --- Produto: readiness editorial -------------------------------------------
  [ISSUE_CODES.productTitleMissing]: {
    message: () => 'Título não definido.',
    suggestion: 'Informe um título provisório para continuar.',
  },
  [ISSUE_CODES.productSlugMissing]: {
    message: () => 'Slug não definido.',
    suggestion: 'Revise o endereço gerado para a peça.',
  },
  [ISSUE_CODES.productCodeMissing]: {
    message: () => 'Código não definido.',
    suggestion: 'Informe um código único para a peça.',
  },
  [ISSUE_CODES.productCategoriesMissing]: {
    message: () => 'Categoria não definida.',
    suggestion: 'Escolha ao menos uma categoria publicada e ativa.',
  },
  [ISSUE_CODES.productCategoriesInactive]: {
    message: () => 'Todo produto ativo precisa apontar somente para categorias ativas e publicadas.',
    suggestion: 'Publique as categorias vinculadas ou selecione outras já ativas.',
  },
  [ISSUE_CODES.productCatalogStatusInvalid]: {
    message: () => 'Status de catálogo inválido.',
    suggestion: 'Escolha entre ativo e arquivado.',
  },
  [ISSUE_CODES.productAvailabilityMissing]: {
    message: () => 'Disponibilidade não definida.',
    suggestion: 'Escolha a disponibilidade que descreve a peça.',
  },
  [ISSUE_CODES.productGalleryEmpty]: {
    message: () => 'Produto sem imagem.',
    suggestion: 'Adicione imagens válidas, texto alternativo e marque exatamente uma capa.',
  },
  [ISSUE_CODES.productGalleryMediaInvalid]: {
    message: () => 'Galeria sem mídia válida.',
    suggestion: 'Selecione novamente as mídias da galeria.',
  },
  [ISSUE_CODES.productGalleryAltRequired]: {
    message: (params) => `Adicione um texto alternativo à imagem ${params.position}.`,
    suggestion: 'Descreva o objeto, o material e o enquadramento.',
  },
  [ISSUE_CODES.productGalleryCoverCount]: {
    message: () => 'Defina exatamente uma imagem de capa.',
    suggestion: 'Marque uma única imagem como capa da peça.',
  },
  [ISSUE_CODES.productPriceModeMissing]: {
    message: () => 'Modo de preço não definido.',
    suggestion: 'Escolha entre preço fixo e sob consulta.',
  },
  [ISSUE_CODES.productBasePriceMissing]: {
    message: () => 'Produto com preço fixo sem preço utilizável.',
    suggestion: 'Informe um preço em reais ou altere o produto para sob consulta.',
  },

  // --- Produto: definições de opção -------------------------------------------
  [ISSUE_CODES.productOptionCodeMissing]: {
    message: () => 'Existe uma opção sem código.',
    suggestion: 'Informe um código curto e único para a opção.',
  },
  [ISSUE_CODES.productOptionCodeDuplicated]: {
    message: (params) => `O código de opção ${quoted(params.code)} está repetido.`,
    suggestion: 'Use um código diferente para cada opção.',
  },
  [ISSUE_CODES.productOptionValuesMissing]: {
    message: (params) => `A opção ${quoted(params.code)} não possui valores.`,
    suggestion: 'Cadastre ao menos um valor para a opção.',
  },
  [ISSUE_CODES.productOptionValueCodeMissing]: {
    message: (params) => `A opção ${quoted(params.code)} possui um valor sem código.`,
    suggestion: 'Informe o código de cada valor da opção.',
  },
  [ISSUE_CODES.productOptionValueDuplicated]: {
    message: (params) => `O valor ${quoted(params.value)} está repetido na opção ${quoted(params.code)}.`,
    suggestion: 'Use um valor diferente para cada entrada da opção.',
  },

  // --- Produto: variantes ------------------------------------------------------
  [ISSUE_CODES.productVariantsMissing]: {
    message: () => 'As opções cadastradas ainda não possuem variantes.',
    suggestion: 'Gere as variantes a partir das opções cadastradas.',
  },
  [ISSUE_CODES.productVariantsOptionsMissing]: {
    message: () => 'Existem variantes sem definições de opções.',
    suggestion: 'Cadastre as opções antes das variantes.',
  },
  [ISSUE_CODES.productVariantSkuMissing]: {
    message: () => 'Existe uma variante sem SKU.',
    suggestion: 'Informe um SKU único para cada variante.',
  },
  [ISSUE_CODES.productVariantSkuDuplicated]: {
    message: (params) => `O SKU ${quoted(params.sku)} está repetido neste produto.`,
    suggestion: 'Use um SKU diferente para cada variante.',
  },
  [ISSUE_CODES.productVariantSelectionDuplicated]: {
    message: (params) => `A variante ${variant(params)} repete uma opção.`,
    suggestion: 'Selecione cada opção uma única vez.',
  },
  [ISSUE_CODES.productVariantSelectionIncomplete]: {
    message: (params) => `A variante ${variant(params)} deve selecionar exatamente um valor de cada opção.`,
    suggestion: 'Complete a seleção da variante.',
  },
  [ISSUE_CODES.productVariantOptionUnknown]: {
    message: (params) => `A variante ${variant(params)} usa a opção inexistente ${quoted(params.option)}.`,
    suggestion: 'Escolha uma das opções cadastradas.',
  },
  [ISSUE_CODES.productVariantValueUnknown]: {
    message: (params) => `A variante ${variant(params)} usa o valor inexistente ${quoted(params.value)}.`,
    suggestion: 'Escolha um dos valores cadastrados na opção.',
  },
  [ISSUE_CODES.productVariantCombinationDuplicated]: {
    message: (params) => `A combinação ${quoted(params.combination)} está duplicada.`,
    suggestion: 'Cada combinação de opções deve aparecer uma única vez.',
  },
  [ISSUE_CODES.productVariantMediaUnknown]: {
    message: (params) => `A variante ${variant(params)} usa a mídia inexistente ${quoted(params.key)}.`,
    suggestion: 'Use uma chave de mídia presente na galeria.',
  },
  [ISSUE_CODES.productVariantPriceMissing]: {
    message: (params) => `A variante ${variant(params)} está com preço fixo, mas não possui preço válido.`,
    suggestion: 'Informe o preço da variante ou altere o modo de preço.',
  },
  [ISSUE_CODES.productVariantInheritedPriceMissing]: {
    message: (params) => `A variante ${variant(params)} herda um preço base inexistente.`,
    suggestion: 'Informe o preço base do produto ou defina um preço fixo na variante.',
  },

  // --- Categoria ----------------------------------------------------------------
  [ISSUE_CODES.categoryTitleMissing]: {
    message: () => 'A categoria precisa de um nome.',
    suggestion: 'Informe o nome que será exibido no catálogo.',
  },
  [ISSUE_CODES.categorySlugMissing]: {
    message: () => 'A categoria precisa de um endereço válido.',
    suggestion: 'Revise o endereço gerado automaticamente.',
  },
  [ISSUE_CODES.categoryParentSelfReference]: {
    message: () => 'A categoria não pode ser principal de si mesma.',
    suggestion: 'Escolha outra categoria principal ou deixe o campo vazio.',
  },
  [ISSUE_CODES.categoryParentCycle]: {
    message: () => 'A categoria principal criaria um ciclo na hierarquia.',
    suggestion: 'Escolha uma categoria principal que não descenda desta.',
  },
  [ISSUE_CODES.categoryParentNotFound]: {
    message: () => 'A categoria principal selecionada não existe.',
    suggestion: 'Selecione uma categoria principal existente.',
  },
  [ISSUE_CODES.categoryHierarchyExistingCycle]: {
    message: () => 'A hierarquia existente contém um ciclo e precisa ser corrigida antes desta alteração.',
    suggestion: 'Corrija a hierarquia atual antes de salvar.',
  },
  [ISSUE_CODES.categoryHierarchyDepthExceeded]: {
    message: () => 'A hierarquia excede o limite seguro de profundidade.',
    suggestion: 'Reduza os níveis de categoria principal.',
  },
  [ISSUE_CODES.categoryUsedByPublishedProducts]: {
    message: (params) => `A categoria está vinculada a ${params.linkedProducts} produto(s) ativo(s) e publicado(s).`,
    suggestion: 'Mova ou arquive esses produtos antes de despublicar a categoria.',
  },

  // --- Mídia ---------------------------------------------------------------------
  [ISSUE_CODES.storefrontMediaUrlMissing]: {
    message: () => 'A imagem não possui uma URL pública válida.',
    suggestion: 'Selecione novamente a mídia e confirme que ela foi publicada.',
  },
  [ISSUE_CODES.storefrontMediaUnpublished]: {
    message: () => 'A imagem precisa ser publicada antes de ser usada no site.',
    suggestion: 'Publique a mídia e tente publicar o conteúdo novamente.',
  },
  [ISSUE_CODES.storefrontMediaAltMissing]: {
    message: () => 'A imagem significativa precisa de texto alternativo.',
    suggestion: 'Descreva em uma frase curta o que aparece na imagem.',
  },

  // --- Contrato do storefront: produto -------------------------------------------
  [ISSUE_CODES.storefrontProductIdMissing]: { message: () => 'O produto não possui identificador público.' },
  [ISSUE_CODES.storefrontProductSlugMissing]: { message: () => 'O produto precisa de um endereço válido.' },
  [ISSUE_CODES.storefrontProductCodeMissing]: { message: () => 'O produto precisa de um código único.' },
  [ISSUE_CODES.storefrontProductTitleMissing]: { message: () => 'O produto precisa de um título.' },
  [ISSUE_CODES.storefrontProductNotActive]: { message: () => 'A peça precisa estar ativa para aparecer no site.' },
  [ISSUE_CODES.storefrontProductCategoryMissing]: { message: () => 'Escolha ao menos uma categoria para o produto.' },
  [ISSUE_CODES.storefrontProductCategoryInvalid]: { message: () => 'Existe uma categoria inválida no produto.' },
  [ISSUE_CODES.storefrontProductCategoryUnpublished]: {
    message: (params) => `A categoria ${quoted(params.title || 'selecionada')} não está publicada e ativa.`,
    suggestion: 'Publique a categoria ou selecione outra categoria ativa.',
  },
  [ISSUE_CODES.storefrontProductAvailabilityInvalid]: { message: () => 'Defina uma disponibilidade reconhecida pelo site.' },
  [ISSUE_CODES.storefrontProductGalleryEmpty]: { message: () => 'Adicione ao menos uma imagem ao produto.' },
  [ISSUE_CODES.storefrontProductGalleryItemInvalid]: { message: () => 'Existe um item inválido na galeria.' },
  [ISSUE_CODES.storefrontProductCoverCount]: { message: () => 'Defina exatamente uma imagem como capa.' },
  [ISSUE_CODES.storefrontProductPriceModeInvalid]: { message: () => 'Escolha preço fixo ou sob consulta.' },
  [ISSUE_CODES.storefrontProductPriceMissing]: {
    message: () => 'O produto está com preço fixo, mas não possui preço utilizável.',
    suggestion: 'Informe um preço em reais ou altere o modo para sob consulta.',
  },
  [ISSUE_CODES.storefrontProductInvalidDocument]: { message: () => 'O documento público não possui um formato reconhecido.' },

  // --- Contrato do storefront: categoria -----------------------------------------
  [ISSUE_CODES.storefrontCategoryTitleMissing]: { message: () => 'A categoria precisa de um nome.' },
  [ISSUE_CODES.storefrontCategorySlugMissing]: { message: () => 'A categoria precisa de um endereço válido.' },
  [ISSUE_CODES.storefrontCategoryNotActive]: { message: () => 'A categoria precisa estar ativa para aparecer no catálogo.' },
  [ISSUE_CODES.storefrontCategorySelfParent]: { message: () => 'A categoria não pode ser principal de si mesma.' },
  [ISSUE_CODES.storefrontCategoryInvalidDocument]: { message: () => 'O documento público não possui um formato reconhecido.' },

  // --- Contrato do storefront: home ----------------------------------------------
  [ISSUE_CODES.storefrontHomeCtaInvalid]: { message: () => 'O destino do botão não é seguro ou reconhecido.' },
  [ISSUE_CODES.storefrontHomeInvalidDocument]: { message: () => 'O documento público não possui um formato reconhecido.' },
  [ISSUE_CODES.storefrontNavigationInvalidDocument]: { message: () => 'O documento público não possui um formato reconhecido.' },
  [ISSUE_CODES.storefrontSiteSettingsInvalidDocument]: { message: () => 'O documento público não possui um formato reconhecido.' },

  // --- Concorrência ----------------------------------------------------------------
  [ISSUE_CODES.revisionConflict]: {
    message: () => 'Este conteúdo foi alterado em outra sessão.',
    suggestion: 'Recarregue a versão mais recente, revise as diferenças e tente novamente.',
  },

  // --- Validação do Payload ---------------------------------------------------------
  // A mensagem real vem do próprio Payload; esta é só o piso quando ele não manda uma.
  [ISSUE_CODES.payloadFieldInvalid]: { message: () => 'Revise este campo.' },
}

/** Copy de topo da resposta de erro administrativa, por código. */
export type AdminErrorCopyEntry = { summary: string; message: string }

export const adminErrorCopy = {
  invalid_request: {
    summary: 'Não foi possível entender a solicitação.',
    message: 'A solicitação chegou incompleta ou fora do formato esperado. Recarregue a página e tente novamente.',
  },
  unauthenticated: {
    summary: 'Sessão não autenticada.',
    message: 'Entre novamente para continuar.',
  },
  forbidden: {
    summary: 'Você não tem permissão para esta ação.',
    message: 'Peça acesso a um administrador para continuar.',
  },
  not_found: {
    summary: 'Conteúdo não encontrado.',
    message: 'O item pode ter sido removido por outra pessoa. Atualize a listagem.',
  },
  revision_conflict: {
    summary: 'Este conteúdo foi alterado em outra sessão.',
    message: 'Recarregue a versão mais recente, revise as diferenças e tente novamente.',
  },
  validation_error: {
    summary: 'Revise os campos destacados.',
    message: 'Alguns campos precisam de ajuste antes de salvar.',
  },
  publication_blocked: {
    summary: 'O rascunho foi salvo, mas ainda existem pendências para publicar.',
    message: 'Resolva as pendências do checklist e publique novamente.',
  },
  verification_failed: {
    summary: 'Não foi possível confirmar a publicação no site.',
    message: 'A verificação com o site não respondeu a tempo. Tente novamente em instantes.',
  },
  internal_error: {
    summary: 'Não foi possível concluir a operação.',
    message: 'Tente novamente. Se o problema continuar, informe o código de suporte exibido nesta mensagem.',
  },
} as const satisfies Record<string, AdminErrorCopyEntry>

export type AdminErrorCopyCatalog = Record<string, AdminErrorCopyEntry>
