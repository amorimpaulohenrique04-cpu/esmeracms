'use client'

import React, { useEffect, useRef, useState } from 'react'

export type EChartOption = Record<string, unknown>
export type EChartEvent = {
  componentType?: string
  seriesType?: string
  seriesIndex?: number
  seriesName?: string
  name?: string
  dataIndex?: number
  value?: unknown
  data?: unknown
}

export type EChartHighlight = {
  seriesName?: string
  dataIndex?: number
} | null

type ChartAction = Record<string, unknown> & { type: string }

type ChartInstance = {
  setOption: (option: EChartOption, notMerge?: boolean) => void
  resize: () => void
  dispose: () => void
  on: (event: string, handler: (params: EChartEvent) => void) => void
  off: (event: string, handler?: (params: EChartEvent) => void) => void
  dispatchAction: (action: ChartAction) => void
}

let themeRegistered = false

function accessibleOption(option: EChartOption, ariaLabel: string): EChartOption {
  return {
    ...option,
    animationDuration: 160,
    animationDurationUpdate: 120,
    animationEasingUpdate: 'cubicOut',
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

export function EChart({
  option,
  ariaLabel,
  height = 300,
  highlight = null,
  onClick,
  onHover,
}: {
  option: EChartOption
  ariaLabel: string
  height?: number
  highlight?: EChartHighlight
  onClick?: (event: EChartEvent) => void
  onHover?: (event: EChartEvent | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const optionRef = useRef(option)
  const handlersRef = useRef({ onClick, onHover })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    handlersRef.current = { onClick, onHover }
  }, [onClick, onHover])

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
        const primary = token(styles, '--esmera-chart-1', '#324f46')
        const secondary = token(styles, '--esmera-chart-2', '#70847b')
        const warning = token(styles, '--esmera-chart-3', '#a38357')
        const info = token(styles, '--esmera-chart-4', '#65788d')
        const danger = token(styles, '--esmera-chart-5', '#9c5e57')
        const text = token(styles, '--esmera-text', '#17201c')
        const muted = token(styles, '--esmera-chart-axis', '#6b7671')
        const line = token(styles, '--esmera-line-default', '#d8dfdb')
        const subtle = token(styles, '--esmera-chart-grid', '#e7ebe9')

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

      const clickHandler = (params: EChartEvent) => handlersRef.current.onClick?.(params)
      const hoverHandler = (params: EChartEvent) => handlersRef.current.onHover?.(params)
      const leaveHandler = () => handlersRef.current.onHover?.(null)
      chart.on('click', clickHandler)
      chart.on('mouseover', hoverHandler)
      chart.on('mouseout', leaveHandler)
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

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    chart.dispatchAction({ type: 'downplay', seriesIndex: 'all' })
    if (!highlight) return
    chart.dispatchAction({ type: 'highlight', ...highlight })
    if (typeof highlight.dataIndex === 'number') chart.dispatchAction({ type: 'showTip', ...highlight })
  }, [highlight, ready])

  return (
    <div className="esmera-report-chart" style={{ minHeight: height }}>
      {!ready ? <div className="esmera-report-chart__loading" aria-hidden="true" /> : null}
      <div ref={containerRef} className="esmera-report-chart__canvas" role="img" aria-label={ariaLabel} style={{ height }} />
    </div>
  )
}
