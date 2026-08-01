import type { CommercialEvolution } from '../../../server/reporting'
import type { EChartOption } from './EChart'

export type EvolutionMode = 'volume' | 'revenue'

function shortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function previousValues(
  evolution: CommercialEvolution,
  pick: (point: CommercialEvolution['current'][number]) => number,
) {
  const previous = evolution.previous || []
  return evolution.current.map((_, index) => previous[index] ? pick(previous[index]) : null)
}

function baseOption(evolution: CommercialEvolution): EChartOption {
  return {
    animationDuration: 180,
    grid: { left: 14, right: 18, top: 48, bottom: 18, containLabel: true },
    tooltip: { trigger: 'axis', confine: true },
    legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 2, textStyle: { fontSize: 11 } },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: evolution.current.map((point) => shortDate(point.date)),
      axisLabel: { hideOverlap: true, fontSize: 10 },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10 } },
  }
}

export function commercialEvolutionOption(
  evolution: CommercialEvolution,
  mode: EvolutionMode,
): EChartOption {
  const base = baseOption(evolution)
  const hasComparison = Boolean(evolution.previous?.length)

  if (mode === 'revenue') {
    return {
      ...base,
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => (value / 100).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }),
        },
      },
      series: [
        {
          name: 'Receita',
          type: 'line',
          smooth: 0.25,
          showSymbol: false,
          areaStyle: { opacity: 0.08 },
          data: evolution.current.map((point) => point.revenueCents),
        },
        ...(hasComparison ? [{
          name: 'Receita · comparação',
          type: 'line',
          smooth: 0.25,
          showSymbol: false,
          lineStyle: { type: 'dashed', width: 1.5, opacity: 0.72 },
          data: previousValues(evolution, (point) => point.revenueCents),
        }] : []),
      ],
    }
  }

  return {
    ...base,
    series: [
      {
        name: 'Leads',
        type: 'line',
        smooth: 0.22,
        showSymbol: false,
        data: evolution.current.map((point) => point.leads),
      },
      {
        name: 'Oportunidades',
        type: 'line',
        smooth: 0.22,
        showSymbol: false,
        data: evolution.current.map((point) => point.opportunities),
      },
      {
        name: 'Vendas',
        type: 'bar',
        barMaxWidth: 16,
        data: evolution.current.map((point) => point.sales),
      },
      ...(hasComparison ? [
        {
          name: 'Oportunidades · comparação',
          type: 'line',
          smooth: 0.22,
          showSymbol: false,
          lineStyle: { type: 'dashed', width: 1.5, opacity: 0.72 },
          data: previousValues(evolution, (point) => point.opportunities),
        },
        {
          name: 'Vendas · comparação',
          type: 'line',
          smooth: 0.22,
          showSymbol: false,
          lineStyle: { type: 'dotted', width: 1.5, opacity: 0.72 },
          data: previousValues(evolution, (point) => point.sales),
        },
      ] : []),
    ],
  }
}
