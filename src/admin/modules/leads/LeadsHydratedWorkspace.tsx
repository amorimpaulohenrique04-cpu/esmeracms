'use client'

import React, { useSyncExternalStore } from 'react'

import { Skeleton } from '../../design-system'
import { LeadsWorkspaceClient } from './LeadsWorkspaceClient'

type Props = React.ComponentProps<typeof LeadsWorkspaceClient>

const subscribe = () => () => undefined

export function LeadsHydratedWorkspace(props: Props) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)

  if (!hydrated) {
    return <div className="esmera-leads-hydration" aria-label="Carregando leads">
      <Skeleton height={44} />
      <Skeleton height={420} />
    </div>
  }

  return <LeadsWorkspaceClient {...props} />
}
