import type { AdminViewServerProps } from 'payload'

import { PERFORMANCE_BUDGETS, performanceSnapshot } from '../../../server/performance'
import { EmptyState, ErrorState, IntegrationState, LoadingState } from '../../design-system'
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

  if (!user) return <AccessDenied props={props} area="técnica" />

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
    ['Leads', '/admin/collections/leads', 'Pipeline, interesses, consentimento e próxima ação.'],
    ['Clientes', '/admin/collections/customers', 'Contato, preferências, relacionamento e privacidade.'],
    ['Privacidade', '/admin/privacy', 'Consentimento, portabilidade, solicitações, retenção e anonimização.'],
    ['Vendas', '/admin/collections/sales', 'Itens, snapshots, valores, status e entrega.'],
    ['Pós-venda', '/admin/collections/after-sales', 'Follow-ups, entregas e ocorrências.'],
    ['Tarefas', '/admin/collections/tasks', 'Pendências operacionais vinculadas aos registros.'],
    ['Automação de pós-venda', '/admin/globals/after-sales-automation', 'Regras D+3, D+15, D+90 e preparação de entrega usadas pela Jobs Queue.'],
    ['Atividades', '/admin/collections/activities', 'Linha do tempo de contatos, mensagens, propostas e mudanças.'],
  ]

  const renderEntries = (entries: string[][]) => (
    <div className="esmera-grid-3">
      {entries.map(([title, href, copy]) => (
        <section className="esmera-card" key={href}>
          <div className="esmera-card-body">
            <span className="esmera-eyebrow">Admin técnico</span>
            <h2 style={{ marginTop: 8 }}>{title}</h2>
            <p className="esmera-card-copy">{copy}</p>
            <TechnicalLink href={href}>Abrir</TechnicalLink>
          </div>
        </section>
      ))}
    </div>
  )

  const systemEntries = [
    ['Usuários', '/admin/collections/users', 'Acesso, autenticação e papéis de usuário.'],
    ['Jobs Queue', '/admin/collections/payload-jobs', 'Execuções, tentativas, erros, filas e agendamentos persistidos pelo Payload.'],
    ['Telemetria JSON', '/api/admin-performance', 'Medições locais do processo sem filtros, nomes, e-mails, telefones ou outros dados pessoais.'],
  ]

  return (
    <ViewFrame props={props}>
      <PageHeader eyebrow="Sistema" title="Admin técnico" subtitle="Formulários completos, drafts, versões e capacidades avançadas do Payload. É a mesma fonte de dados do portal operacional." />
      <div className="esmera-state">
        <strong>Uma única verdade</strong>
        <p>O portal operacional organiza tarefas frequentes. Esta área expõe a profundidade técnica sem criar outra base, outro schema ou indicadores paralelos.</p>
      </div>
      {site ? <><h2 style={{ marginTop: 30 }}>Site e catálogo</h2>{renderEntries(siteEntries)}</> : null}
      {business ? <><h2 style={{ marginTop: 30 }}>Business</h2>{renderEntries(businessEntries)}</> : null}
      {role === 'admin' ? <>
        <h2 style={{ marginTop: 30 }}>Sistema</h2>
        {renderEntries(systemEntries)}
        <section className="esmera-card" style={{ marginTop: 20 }} data-testid="state-contract">
          <div className="esmera-card-body">
            <span className="esmera-eyebrow">Contrato de estados</span>
            <h2 style={{ marginTop: 8 }}>Loading, empty, integração e erro</h2>
            <p className="esmera-card-copy">Referência única para todas as views operacionais. Erros nunca são convertidos em zero, NaN, placeholders ou KPIs demonstrativos.</p>
            <div className="esmera-grid-3" style={{ marginTop: 18 }}>
              <LoadingState label="Carregando consulta operacional" rows={3} />
              <EmptyState title="Nenhum registro" copy="A consulta foi concluída com sucesso, mas não há documentos para este recorte." />
              <IntegrationState title="Integração não configurada" copy="A fonte externa ainda não foi conectada. Nenhum valor substituto será exibido." action={<TechnicalLink href="/admin/settings">Ver configurações</TechnicalLink>} />
            </div>
            <div style={{ marginTop: 16 }}>
              <ErrorState title="Falha de consulta" detail="Os últimos dados válidos devem permanecer visíveis. Tente novamente ou consulte o registro técnico." action={<TechnicalLink href="/admin/technical">Tentar novamente</TechnicalLink>} />
            </div>
          </div>
        </section>
        <section className="esmera-card" style={{ marginTop: 20 }}>
          <div className="esmera-card-body">
            <span className="esmera-eyebrow">Performance medida</span>
            <h2 style={{ marginTop: 8 }}>Orçamentos e P95 do processo atual</h2>
            <p className="esmera-card-copy">Consultas operacionais têm alvo P95 de {PERFORMANCE_BUDGETS.operationalQueryP95Ms} ms; relatórios agregados, {PERFORMANCE_BUDGETS.reportingQueryP95Ms} ms. As amostras reiniciam com o processo.</p>
            {!measurements.length ? <EmptyState title="Sem amostras neste processo" copy="Navegue pelas áreas operacionais e retorne para consultar os tempos medidos." /> : <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Área</th><th>Operação</th><th>P95</th><th>Amostras</th><th>Orçamento</th><th>Estado</th></tr></thead><tbody>{measurements.map((item) => <tr key={`${item.area}:${item.name}`}><td>{item.area}</td><td>{item.name}</td><td>{item.p95Ms} ms</td><td>{item.sampleSize}</td><td>{item.budgetMs} ms</td><td>{item.withinBudget ? 'Dentro' : 'Acima'}</td></tr>)}</tbody></table></div>}
          </div>
        </section>
      </> : null}
    </ViewFrame>
  )
}
