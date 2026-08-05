'use client'

import React from 'react'

import { Skeleton } from '../design-system/Feedback'
import type { SkeletonVariant } from './navigation-intent'

/** Reproduz aproximadamente a geometria do Dashboard (métricas + colunas). */
function DashboardBody() {
  return (
    <>
      <div className="esmera-route-skeleton__header">
        <Skeleton width="38%" height={26} />
        <Skeleton width="52%" height={14} />
      </div>
      <div className="esmera-route-skeleton__metrics">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="esmera-route-skeleton__metric" key={index}>
            <Skeleton width="58%" height={11} />
            <Skeleton width="44%" height={24} />
            <Skeleton width="72%" height={10} />
          </div>
        ))}
      </div>
      <div className="esmera-route-skeleton__columns">
        <Skeleton height={240} />
        <Skeleton height={240} />
      </div>
    </>
  )
}

/** Reproduz aproximadamente uma listagem: cabeçalho + barra de ferramentas + linhas. */
function ListBody() {
  return (
    <>
      <div className="esmera-route-skeleton__header">
        <Skeleton width="28%" height={24} />
        <Skeleton width="130px" height={36} />
      </div>
      <Skeleton height={52} />
      <div className="esmera-route-skeleton__rows">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="esmera-route-skeleton__row" key={index}>
            <Skeleton width="48%" height={13} />
            <Skeleton width="16%" height={13} />
            <Skeleton width="12%" height={13} />
          </div>
        ))}
      </div>
    </>
  )
}

/** Reproduz aproximadamente um formulário: cabeçalho + campos empilhados. */
function FormBody() {
  return (
    <>
      <div className="esmera-route-skeleton__header">
        <Skeleton width="32%" height={24} />
        <Skeleton width="110px" height={36} />
      </div>
      <div className="esmera-route-skeleton__fields">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="esmera-route-skeleton__field" key={index}>
            <Skeleton width="20%" height={10} />
            <Skeleton height={38} />
          </div>
        ))}
      </div>
      <Skeleton height={130} />
    </>
  )
}

export function RouteSkeleton({ variant, message }: { variant: SkeletonVariant; message: string | null }) {
  return (
    <div
      className="esmera-route-skeleton"
      data-testid="esmera-route-skeleton"
      data-variant={variant}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Vazio até o limiar de anúncio (~1.2s): navegações rápidas não devem
          gerar leitura de tela nenhuma — ver SKILL.md §12 e Feedback.tsx
          (mesmo padrão de role/aria-live/aria-busy de LoadingState). */}
      <span className="esmera-sr-only">{message || ''}</span>
      <div className="esmera-route-skeleton__body" aria-hidden="true">
        {variant === 'dashboard' ? <DashboardBody /> : variant === 'form' ? <FormBody /> : <ListBody />}
      </div>
    </div>
  )
}
