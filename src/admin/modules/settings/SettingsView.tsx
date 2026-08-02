import type { AdminViewServerProps } from 'payload'

import {
  AccessDenied,
  ensureUser,
  PageHeader,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

export async function SettingsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />

  return <ViewFrame props={props}>
    <PageHeader eyebrow="Site" title="Configurações" subtitle="Atalhos seguros para configuração editorial. Status de infraestrutura não é presumido pela interface." />
    <div className="esmera-grid-equal">
      <section className="esmera-card"><div className="esmera-card-body"><h2>Configurações do site</h2><p className="esmera-card-copy">Canais oficiais, URL do frontend e defaults editoriais.</p><TechnicalLink href="/admin/globals/site-settings">Abrir configurações</TechnicalLink></div></section>
      <section className="esmera-card"><div className="esmera-card-body"><h2>Navegação</h2><p className="esmera-card-copy">Links principais, categorias do submenu e utilitários.</p><TechnicalLink href="/admin/globals/navigation">Editar navegação</TechnicalLink></div></section>
    </div>
    <div className="esmera-state esmera-state--warning"><strong>Infraestrutura</strong><p>Banco, storage, CORS, backups e credenciais são verificados fora desta UI. O painel não exibe selos de segurança sem health check real.</p></div>
  </ViewFrame>
}
