export const HOME_EDITORIAL_SECTIONS = [
  { key: 'hero', label: 'Capa principal', fields: ['heroSlides'] },
  {
    key: 'manifesto',
    label: 'Manifesto',
    fields: [
      'manifestoEyebrow',
      'manifestoTitle',
      'manifestoCopy',
      'manifestoPrimaryImage',
      'manifestoSecondaryImage',
    ],
  },
  { key: 'selectedObjects', label: 'Seleção de objetos', fields: ['selectedProducts'] },
  { key: 'matter', label: 'Matéria', fields: ['matterPanels'] },
  { key: 'signature', label: 'Destaques', fields: ['signatureSlides'] },
  { key: 'matterInterlude', label: 'Intervalo visual', fields: [] },
  {
    key: 'provenance',
    label: 'Proveniência',
    fields: [
      'provenanceTitle',
      'provenanceCopy',
      'provenanceImage',
      'provenanceSteps',
      'provenanceCallToAction',
    ],
  },
  { key: 'privateInvitation', label: 'Convite privado', fields: [] },
] as const

export type HomeSectionKey = (typeof HOME_EDITORIAL_SECTIONS)[number]['key']
export type HomeSectionEditorialState = 'site_default' | 'customized' | 'hidden'
export type HomeEditorialValues = Record<string, unknown>

export const HOME_EDITORIAL_FIELD_PATHS = [
  'disabledSections',
  ...new Set(HOME_EDITORIAL_SECTIONS.flatMap((section) => [...section.fields])),
]

const RICH_TEXT_METADATA_KEYS = new Set([
  'detail',
  'direction',
  'format',
  'indent',
  'mode',
  'style',
  'tag',
  'type',
  'version',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function hasMeaningfulHomeValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return false
  if (Array.isArray(value)) return value.some(hasMeaningfulHomeValue)
  if (!isRecord(value)) return false

  if (
    Object.prototype.hasOwnProperty.call(value, 'id')
    && (typeof value.id === 'string' || typeof value.id === 'number')
    && String(value.id).trim().length > 0
  ) {
    return true
  }

  if (isRecord(value.root)) {
    return hasMeaningfulHomeValue(value.root.children)
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    !RICH_TEXT_METADATA_KEYS.has(key) && hasMeaningfulHomeValue(nestedValue)
  ))
}

function disabledSectionKeys(value: unknown): Set<HomeSectionKey> {
  if (!Array.isArray(value)) return new Set()

  return new Set(
    value.filter((item): item is HomeSectionKey => (
      typeof item === 'string'
      && HOME_EDITORIAL_SECTIONS.some((section) => section.key === item)
    )),
  )
}

export function getHomeSectionEditorialState(
  sectionKey: HomeSectionKey,
  values: HomeEditorialValues,
): HomeSectionEditorialState {
  if (disabledSectionKeys(values.disabledSections).has(sectionKey)) return 'hidden'

  const section = HOME_EDITORIAL_SECTIONS.find((candidate) => candidate.key === sectionKey)
  if (!section || section.fields.length === 0) return 'site_default'

  return section.fields.some((path) => hasMeaningfulHomeValue(values[path]))
    ? 'customized'
    : 'site_default'
}
