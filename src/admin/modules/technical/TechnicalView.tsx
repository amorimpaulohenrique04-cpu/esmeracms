import type { AdminViewServerProps } from 'payload'

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
      {role === 'admin' ? <><h2 style={{ marginTop: 30 }}>Sistema</h2>{renderEntries(systemEntries)}</> : null}
    </ViewFrame>
  )
}
