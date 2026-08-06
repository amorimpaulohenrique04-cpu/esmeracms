export const acquisitionChannels = [
  'instagram',
  'referral',
  'site',
  'architect',
  'organic',
  'whatsapp',
  'other',
] as const

export type AcquisitionChannel = typeof acquisitionChannels[number]

export const acquisitionChannelLabels: Record<AcquisitionChannel, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

export const acquisitionChannelOptions = acquisitionChannels.map((value) => ({ label: acquisitionChannelLabels[value], value }))
