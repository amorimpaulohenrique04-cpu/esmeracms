'use client'

import React, { useSyncExternalStore } from 'react'

import { Skeleton } from '../../design-system'
import { AfterSalesWorkspaceClient } from './AfterSalesWorkspaceClient'

type Props = React.ComponentProps<typeof AfterSalesWorkspaceClient>

const subscribe = () => () => undefined

export function AfterSalesHydratedWorkspace(props: Props) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)

  if (!hydrated) {
    return <div className="esmera-after-sales-hydration" aria-label="Carregando fila de pós-venda">
      <Skeleton height={92} />
      <Skeleton height={420} />
    </div>
  }

  return <AfterSalesWorkspaceClient {...props} />
}
