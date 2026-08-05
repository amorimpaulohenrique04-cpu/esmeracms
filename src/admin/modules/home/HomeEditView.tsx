'use client'

import { DefaultEditView, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'
import React from 'react'

import { FormShell } from '../../design-system/FormSystem'
import {
  getHomeSectionEditorialState,
  HOME_EDITORIAL_FIELD_PATHS,
  HOME_EDITORIAL_SECTIONS,
  type HomeEditorialValues,
  type HomeSectionEditorialState,
} from './homeEditorialState'

const STATE_COPY: Record<HomeSectionEditorialState, { label: string; description: string }> = {
  site_default: {
    label: 'Padrão do site',
    description: 'O site usará a versão padrão construída no Deco.',
  },
  customized: {
    label: 'Personalizado',
    description: 'Os valores preenchidos no CMS substituem a versão padrão desta seção.',
  },
  hidden: {
    label: 'Oculto',
    description: 'A seção está explicitamente desativada no CMS.',
  },
}

function formatUpdatedAt(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR')
}

export function HomeEditorialOverview() {
  const values = useFormFields(([fields]) => {
    const snapshot: HomeEditorialValues = {}

    for (const path of HOME_EDITORIAL_FIELD_PATHS) {
      snapshot[path] = fields[path]?.value
    }

    return snapshot
  })
  const { data } = useDocumentInfo()
  const status = data?._status === 'published' ? 'Publicado no Payload' : 'Rascunho'
  const updatedAt = formatUpdatedAt(data?.updatedAt)

  return (
    <FormShell
      title="Visão editorial da Home"
      description="Os campos continuam no formulário oficial do Payload. Este painel explica o efeito editorial de cada seção sem duplicar o documento ou a lógica da Deco."
    >
      <div className="esmera-home-editorial-overview" role="list" aria-label="Estado editorial das seções da Home">
        {HOME_EDITORIAL_SECTIONS.map((section) => {
          const state = getHomeSectionEditorialState(section.key, values)
          const copy = STATE_COPY[state]

          return (
            <article
              className={`esmera-home-editorial-overview__section is-${state}`}
              key={section.key}
              role="listitem"
            >
              <div>
                <h3>{section.label}</h3>
                <p>{copy.description}</p>
              </div>
              <strong>{copy.label}</strong>
            </article>
          )
        })}
      </div>

      <section className="esmera-home-editorial-overview__publication" aria-label="Estado de salvamento e publicação">
        <strong>{status}</strong>
        {updatedAt ? <span>Última atualização: {updatedAt}</span> : null}
        <p>
          Salvar e publicar usam os controles oficiais do Payload. Esta tela não possui
          confirmação real de visibilidade no site, portanto não apresenta “Visível no site”
          sem uma verificação contratual.
        </p>
      </section>
    </FormShell>
  )
}

export function HomeEditView(props: DocumentViewClientProps) {
  // `Description` é um slot ReactNode: passar a referência do componente fazia o
  // React descartar o painel em runtime. O elemento renderiza na posição do slot,
  // dentro dos providers de formulário que `useFormFields` e `useDocumentInfo` exigem.
  return <DefaultEditView {...props} Description={<HomeEditorialOverview />} />
}
