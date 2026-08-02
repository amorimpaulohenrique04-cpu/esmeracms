import type { AdminViewServerProps } from 'payload'

import { DataSection, IntegrationState } from '../../design-system'
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

  return <ViewFrame props={props} width="standard">
    <PageHeader eyebrow="Site" title="Configurações" subtitle="Parâmetros editoriais e canais oficiais. Estados de infraestrutura só aparecem quando existe verificação real." />
    <div className="esmera-grid-equal">
      <DataSection
        eyebrow="Global"
        title="Configurações do site"
        description="Canais oficiais, URL pública, defaults editoriais e parâmetros usados pelas páginas do frontend."
        action={<TechnicalLink href="/admin/globals/site-settings">Abrir configurações</TechnicalLink>}
      >
        <div className="esmera-card-body"><p className="esmera-card-copy">Edite somente valores que pertencem ao conteúdo e à operação editorial. Credenciais e segredos não são expostos nesta interface.</p></div>
      </DataSection>
      <DataSection
        eyebrow="Global"
        title="Navegação"
        description="Links principais, categorias do submenu e utilitários compartilhados entre desktop e mobile."
        action={<TechnicalLink href="/admin/globals/navigation">Editar navegação</TechnicalLink>}
      >
        <div className="esmera-card-body"><p className="esmera-card-copy">A navegação publicada permanece uma única estrutura editorial, evitando divergência entre os dispositivos.</p></div>
      </DataSection>
    </div>
    <IntegrationState
      title="Infraestrutura não é inferida"
      copy="Banco, storage, CORS, backups, filas e credenciais são verificados fora desta tela. Selos de segurança ou disponibilidade só devem aparecer quando houver health check verificável."
      action={<TechnicalLink href="/admin/technical">Abrir Admin técnico</TechnicalLink>}
    />
  </ViewFrame>
}
