export type ImportColumn =
  | 'title'
  | 'code'
  | 'slug'
  | 'categories'
  | 'material'
  | 'description'
  | 'availability'
  | 'price'
  | 'priceMode'
  | 'catalogStatus'
  | 'imageUrls'

export const importColumns: ImportColumn[] = [
  'title', 'code', 'categories', 'price', 'priceMode', 'availability', 'catalogStatus', 'imageUrls', 'material', 'description', 'slug',
]

export const importColumnLabels: Record<ImportColumn, string> = {
  title: 'nome',
  code: 'codigo',
  slug: 'slug',
  categories: 'categoria',
  material: 'material',
  description: 'descricao',
  availability: 'disponibilidade',
  price: 'preco',
  priceMode: 'modo_preco',
  catalogStatus: 'status',
  imageUrls: 'imagens',
}

export const importColumnRequired: Record<ImportColumn, boolean> = {
  title: true,
  code: true,
  slug: false,
  categories: false,
  material: false,
  description: false,
  availability: false,
  price: false,
  priceMode: false,
  catalogStatus: false,
  imageUrls: false,
}

/** Aceita variações comuns de cabeçalho (com/sem acento, singular/plural, PT/EN) apontando para a mesma coluna real do schema. */
const headerAliases: Record<string, ImportColumn> = {
  nome: 'title', name: 'title', titulo: 'title', título: 'title', title: 'title',
  codigo: 'code', código: 'code', code: 'code', sku: 'code',
  slug: 'slug',
  categoria: 'categories', categorias: 'categories', category: 'categories', categories: 'categories',
  material: 'material',
  descricao: 'description', descrição: 'description', description: 'description',
  disponibilidade: 'availability', availability: 'availability',
  preco: 'price', preço: 'price', price: 'price', valor: 'price',
  modo_preco: 'priceMode', 'modo preço': 'priceMode', 'modo de preço': 'priceMode', 'modo de preco': 'priceMode', pricemode: 'priceMode', 'price mode': 'priceMode',
  status: 'catalogStatus', 'status de publicação': 'catalogStatus', 'status de publicacao': 'catalogStatus', catalogstatus: 'catalogStatus',
  imagens: 'imageUrls', imagem: 'imageUrls', imagem_url: 'imageUrls', image_urls: 'imageUrls', images: 'imageUrls', 'image urls': 'imageUrls',
}

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

export function resolveHeaderColumn(header: string): ImportColumn | null {
  return headerAliases[normalizeHeader(header)] || null
}

export const availabilityLabelToValue: Record<string, string> = {
  'peça única': 'unique', 'peca unica': 'unique', unique: 'unique',
  'disponível': 'available', disponivel: 'available', available: 'available',
  'sob encomenda': 'made_to_order', made_to_order: 'made_to_order',
  'edição limitada': 'limited', 'edicao limitada': 'limited', limited: 'limited',
}

export const catalogStatusLabelToValue: Record<string, string> = {
  ativo: 'active', active: 'active',
  arquivado: 'archived', archived: 'archived',
}

export const priceModeLabelToValue: Record<string, string> = {
  fixo: 'fixed', fixed: 'fixed',
  'sob consulta': 'inquiry', consulta: 'inquiry', inquiry: 'inquiry',
}

export function templateRows(): string[][] {
  const header = importColumns.map((column) => importColumnLabels[column])
  const example = [
    'Vaso Terracota', 'OBJ-101', 'Cerâmica', '890,00', 'Fixo', 'Disponível', 'Ativo',
    'https://exemplo.com/imagens/vaso-1.jpg;https://exemplo.com/imagens/vaso-2.jpg',
    'Cerâmica esmaltada', 'Peça torneada à mão, acabamento fosco.', 'vaso-terracota',
  ]
  return [header, example]
}
