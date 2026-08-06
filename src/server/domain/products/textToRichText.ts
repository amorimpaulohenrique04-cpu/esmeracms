/** Converte texto simples (uma ou mais linhas) num documento Lexical mínimo válido para o campo richText de Products.description. */
export function textToRichText(text: string) {
  const paragraphs = text.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean)
  const children = (paragraphs.length ? paragraphs : ['']).map((line) => ({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    children: line ? [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: line, version: 1 }] : [],
    direction: 'ltr' as const,
  }))

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children,
      direction: 'ltr' as const,
    },
  }
}
