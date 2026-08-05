'use client'

import React from 'react'

import type { NavigationPhase } from './NavigationFeedbackProvider'

/**
 * Barra fina indeterminada — nunca reflete percentual real (ver
 * .agents/skills/esmera-motion-system/SKILL.md §6). Toda a lógica visual
 * vive em navigation-feedback.scss, orientada por `data-phase`; este
 * componente é puramente presentacional.
 */
export function RouteProgressBar({ phase }: { phase: NavigationPhase }) {
  return <div className="esmera-route-progress" data-phase={phase} aria-hidden="true" />
}
