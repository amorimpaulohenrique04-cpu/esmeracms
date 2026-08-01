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

export function EChart({
  option,
  ariaLabel,
  height = 320,
}: {
  option: EChartOption
  ariaLabel: string
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const optionRef = useRef(option)
  const [ready, setReady] = useState(false)

  optionRef.current = option

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
        core.registerTheme('esmera-reporting', {
          color: ['#355e52', '#6d8078', '#a98557', '#7c899d', '#9c5e57'],
          backgroundColor: 'transparent',
          textStyle: {
            color: '#27312d',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          },
          line: { itemStyle: { borderWidth: 2 }, lineStyle: { width: 2 }, symbolSize: 6 },
          bar: { itemStyle: { borderRadius: 0 } },
          categoryAxis: {
            axisLine: { lineStyle: { color: '#d9dfdc' } },
            axisTick: { show: false },
            axisLabel: { color: '#69736f' },
            splitLine: { show: false },
          },
          valueAxis: {
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#69736f' },
            splitLine: { lineStyle: { color: '#e8ecea' } },
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
    chartRef.current?.setOption(accessibleOption(option, ariaLabel), true)
  }, [ariaLabel, option])

  return (
    <div className="esmera-report-chart" style={{ minHeight: height }}>
      {!ready ? <div className="esmera-report-chart__loading" aria-hidden="true" /> : null}
      <div
        ref={containerRef}
        className="esmera-report-chart__canvas"
        role="img"
        aria-label={ariaLabel}
        style={{ height }}
      />
    </div>
  )
}
