'use client'

import React, { useEffect, useRef, useState } from 'react'

export type EChartOption = Record<string, unknown>

type ChartInstance = {
  setOption: (option: EChartOption, notMerge?: boolean) => void
  resize: () => void
  dispose: () => void
}

let themeRegistered = false

function accessibleOption(option: EChartOption, ariaLabel: string): EChartOption {
  return {
    ...option,
    aria: {
      enabled: true,
      description: ariaLabel,
      decal: { show: false },
    },
  }
}

function token(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback
}

export function EChart({ option, ariaLabel, height = 300 }: { option: EChartOption; ariaLabel: string; height?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const optionRef = useRef(option)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let removeWindowResize: (() => void) | null = null

    async function mount() {
      const container = containerRef.current
      if (!container) return

      const [core, charts, components, renderers] = await Promise.all([
        import('echarts/core'),
        import('echarts/charts'),
        import('echarts/components'),
        import('echarts/renderers'),
      ])
      if (cancelled) return

      core.use([
        charts.LineChart,
        charts.BarChart,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        components.DatasetComponent,
        components.AriaComponent,
        renderers.SVGRenderer,
      ])

      if (!themeRegistered) {
        const styles = getComputedStyle(container)
        const primary = token(styles, '--esmera-primary', '#355e52')
        const secondary = token(styles, '--esmera-text-secondary', '#6d8078')
        const warning = token(styles, '--esmera-warning', '#a98557')
        const info = token(styles, '--esmera-info', '#65788d')
        const danger = token(styles, '--esmera-danger', '#9c5e57')
        const text = token(styles, '--esmera-text', '#27312d')
        const muted = token(styles, '--esmera-text-muted', '#69736f')
        const line = token(styles, '--esmera-line', '#d9dfdc')
        const subtle = token(styles, '--esmera-surface-muted', '#f4f6f5')

        core.registerTheme('esmera-reporting', {
          color: [primary, secondary, warning, info, danger],
          backgroundColor: 'transparent',
          textStyle: { color: text, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
          line: { itemStyle: { borderWidth: 2 }, lineStyle: { width: 2 }, symbolSize: 6 },
          bar: { itemStyle: { borderRadius: 0 } },
          categoryAxis: {
            axisLine: { lineStyle: { color: line } },
            axisTick: { show: false },
            axisLabel: { color: muted },
            splitLine: { show: false },
          },
          valueAxis: {
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: muted },
            splitLine: { lineStyle: { color: subtle } },
          },
        })
        themeRegistered = true
      }

      const chart = core.init(container, 'esmera-reporting', { renderer: 'svg' }) as ChartInstance
      chartRef.current = chart
      chart.setOption(accessibleOption(optionRef.current, ariaLabel), true)
      setReady(true)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => chart.resize())
        resizeObserver.observe(container)
      } else {
        const onResize = () => chart.resize()
        window.addEventListener('resize', onResize)
        removeWindowResize = () => window.removeEventListener('resize', onResize)
      }
    }

    void mount()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      removeWindowResize?.()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [ariaLabel])

  useEffect(() => {
    optionRef.current = option
    chartRef.current?.setOption(accessibleOption(option, ariaLabel), true)
  }, [ariaLabel, option])

  return (
    <div className="esmera-report-chart" style={{ minHeight: height }}>
      {!ready ? <div className="esmera-report-chart__loading" aria-hidden="true" /> : null}
      <div ref={containerRef} className="esmera-report-chart__canvas" role="img" aria-label={ariaLabel} style={{ height }} />
    </div>
  )
}
