import type { AdminViewServerProps } from 'payload'

import { PERFORMANCE_BUDGETS, performanceSnapshot } from '../../../server/performance'
import {
  DataSection,
  EmptyState,
  ErrorState,
  IntegrationState,
  LoadingState,
  PartialDataState,
  Status,
} from '../../design-system'
import {
  AccessDenied,
  ensureUser,
  PageHeader,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

export async function TechnicalView(props: AdminViewServerProps) {
  const { user, role } = ensureUser(props)
  const site = role === 'admin' || role === 'editor'
  const business = role === 'admin' || role === 'commercial'
  const measurements = role === 'admin' ? performanceSnapshot() : []

  if (!user || role !== 'admin') return <AccessDenied props={props} area="técnica" />

  const siteEntries = [
    ['Produtos', '/admin/collections/products', 'Campos completos, drafts, versões e histórico do catálogo.'],
    ['Categorias', '/admin/collections/categories', 'Taxonomia, hierarquia, SEO e publicação.'],
    ['Mídia', '/admin/collections/media', 'Biblioteca de imagens e metadados acessíveis.'],
    ['Home', '/admin/globals/home', 'Hero, manifesto, seleção, Matter, Signature e proveniência.'],
    ['Sobre', '/admin/globals/about', 'Conteúdo institucional e SEO.'],
    ['Contato', '/admin/globals/contact', 'Canais, atendimento e CTA.'],
    ['Coleção', '/admin/globals/collection-page', 'Filtros, textos e estado vazio.'],
    ['Navegação', '/admin/globals/navigation', 'Menu principal e links utilitários.'],
    ['Configurações do site', '/admin/globals/site-settings', 'Canais oficiais e parâmetros editoriais.'],
  ]

  const businessEntries = [
    ['Leads', '/admin/leads', 'Aquisição, qualificação e consentimento inicial.'],
    ['Clientes', '/admin/collections/customers', 'Contato, preferências, relacionamento e privacidade.'],
    ['Privacidade', '/admin/privacy', 'Consentimento, portabilidade, solicitações, retenção e anonimização.'],
    ['Oportunidades', '/admin/opportunities', 'Pipeline comercial, valores, próxima ação e fechamento.'],
    ['Vendas', '/admin/sales', 'Itens, snapshots, valores, status e entrega.'],
    ['Pós-venda', '/admin/collections/after-sales', 'Follow-ups, entregas e ocorrências.'],
    ['Tarefas', '/admin/collections/tasks', 'Pendências operacionais vinculadas aos registros.'],
    ['Automação de pós-venda', '/admin/globals/after-sales-automation', 'Regras D+3, D+15, D+90 e preparação de entrega usadas pela Jobs Queue.'],
    ['Atividades', '/admin/collections/activities', 'Linha do tempo de contatos, propostas, notas e mudanças.'],
  ]

  const systemEntries = [
    ['Usuários', '/admin/collections/users', 'Acesso, autenticação e papéis de usuário.'],
    ['Jobs Queue', '/admin/collections/payload-jobs', 'Execuções, tentativas, erros, filas e agendamentos persistidos pelo Payload.'],
    ['Telemetria JSON', '/api/admin-performance', 'Medições locais do processo sem filtros ou dados pessoais.'],
  ]

  const renderEntries = (entries: string[][]) => (
    <div className="esmera-technical-links">
      {entries.map(([title, href, copy]) => (
        <a className="esmera-technical-link" href={href} key={href}>
          <span>{title}</span>
          <small>{copy}</small>
          <strong aria-hidden="true">↗</strong>
        </a>
      ))}
    </div>
  )

  return (
    <ViewFrame props={props} width="wide" className="esmera-technical-view">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações avançadas"
        subtitle="Formulários completos, drafts, versões, filas e capacidades avançadas do Payload. Visível apenas para administradores."
        context={<span>Papel atual: {role || 'sem papel'} · acesso técnico respeita as mesmas permissões das Collections e APIs.</span>}
      />

      <PartialDataState
        title="Uma única verdade, duas profundidades"
        copy="O portal operacional organiza tarefas frequentes. Esta área expõe a profundidade técnica sem criar outra base, outro schema ou indicadores paralelos."
        detail="Algumas superfícies abaixo dependem do papel atual e do processo em execução."
      />

      {site ? <DataSection className="esmera-technical-section" eyebrow="Conteúdo" title="Site e catálogo" description="Collections e Globals editoriais com todos os campos, versões e relações.">{renderEntries(siteEntries)}</DataSection> : null}
      {business ? <DataSection className="esmera-technical-section" eyebrow="Operação" title="Business" description="Domínios comerciais e relacionais, mantendo Leads, Opportunities, Sales e pós-venda separados.">{renderEntries(businessEntries)}</DataSection> : null}

      {role === 'admin' ? <>
        <DataSection className="esmera-technical-section" eyebrow="Administração" title="Sistema" description="Usuários, filas persistidas e telemetria operacional sem dados pessoais.">{renderEntries(systemEntries)}</DataSection>

        <DataSection className="esmera-technical-section" eyebrow="Contrato de estados" title="Loading, empty, integração e erro" description="Referência única para todas as views operacionais. Erros nunca são convertidos em zero, NaN, placeholders ou KPIs demonstrativos.">
          <div className="esmera-technical-state-grid" data-testid="state-contract">
            <LoadingState label="Carregando consulta operacional" rows={3} />
            <EmptyState title="Nenhum registro" copy="A consulta foi concluída com sucesso, mas não há documentos para este recorte." />
            <IntegrationState title="Integração não configurada" copy="A fonte externa ainda não foi conectada. Nenhum valor substituto será exibido." action={<TechnicalLink href="/admin/settings">Ver configurações</TechnicalLink>} />
          </div>
          <div className="esmera-technical-state-error"><ErrorState title="Falha de consulta" detail="Os últimos dados válidos devem permanecer visíveis. Tente novamente ou consulte o registro técnico." action={<TechnicalLink href="/admin/technical">Tentar novamente</TechnicalLink>} /></div>
        </DataSection>

        <DataSection className="esmera-technical-section" eyebrow="Performance medida" title="Orçamentos e P95 do processo atual" description={`Consultas operacionais têm alvo P95 de ${PERFORMANCE_BUDGETS.operationalQueryP95Ms} ms; relatórios agregados, ${PERFORMANCE_BUDGETS.reportingQueryP95Ms} ms. As amostras reiniciam com o processo.`}>
          {!measurements.length ? <EmptyState title="Sem amostras neste processo" copy="Navegue pelas áreas operacionais e retorne para consultar os tempos medidos." /> : <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Área</th><th>Operação</th><th>P95</th><th>Amostras</th><th>Orçamento</th><th>Estado</th></tr></thead><tbody>{measurements.map((item) => <tr key={`${item.area}:${item.name}`}><td>{item.area}</td><td>{item.name}</td><td>{item.p95Ms} ms</td><td>{item.sampleSize}</td><td>{item.budgetMs} ms</td><td><Status tone={item.withinBudget ? 'success' : 'warning'}>{item.withinBudget ? 'Dentro' : 'Acima'}</Status></td></tr>)}</tbody></table></div>}
        </DataSection>
      </> : null}
    </ViewFrame>
  )
}
