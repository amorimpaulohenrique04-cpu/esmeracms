from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{relative}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/admin/design-system/Overlays.tsx',
    "export function DialogPanel({ trigger, title, description, children }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {",
    "export function DialogPanel({ trigger, triggerClassName = '', title, description, children }: { trigger: React.ReactNode; triggerClassName?: string; title: string; description?: string; children: React.ReactNode }) {",
)
replace_once(
    'src/admin/design-system/Overlays.tsx',
    '<Dialog.Trigger className="esmera-button" data-esmera-context-key={contextKey}>{trigger}</Dialog.Trigger>',
    "<Dialog.Trigger className={`esmera-button${triggerClassName ? ` ${triggerClassName}` : ''}`} data-esmera-context-key={contextKey}>{trigger}</Dialog.Trigger>",
)

replace_once(
    'src/admin/modules/categories/CategoryCreateDialog.tsx',
    '''  return <DialogPanel
    trigger="Nova categoria"
    title="Nova categoria"''',
    '''  return <DialogPanel
    trigger="Nova categoria"
    triggerClassName="esmera-button--primary"
    title="Nova categoria"''',
)

replace_once(
    'src/admin/views/shared.tsx',
    '''  context,
  sticky = false,
}: {
  eyebrow?: string
  title: string
  subtitle: string
  actions?: React.ReactNode
  context?: React.ReactNode
  sticky?: boolean
}) {
  return <PageCommandBar eyebrow={eyebrow} title={title} description={subtitle} actions={actions} context={context} sticky={sticky} />
}''',
    '''  context,
  sticky = false,
  className = '',
}: {
  eyebrow?: string
  title: string
  subtitle: string
  actions?: React.ReactNode
  context?: React.ReactNode
  sticky?: boolean
  className?: string
}) {
  return <PageCommandBar eyebrow={eyebrow} title={title} description={subtitle} actions={actions} context={context} sticky={sticky} className={className} />
}''',
)

replace_once(
    'src/admin/modules/sales/SalesViews.tsx',
    '''      <PageHeader
        eyebrow="Comercial"''',
    '''      <PageHeader
        className="esmera-sales-command-bar"
        eyebrow="Comercial"''',
)

path = ROOT / 'src/admin/modules/sales/sale-create-dialog.scss'
text = path.read_text(encoding='utf-8')
addition = '''
@container esmera-workspace (min-width: 701px) and (max-width: 1220px) {
  .esmera-sales-command-bar .esmera-command-bar__main {
    flex-wrap: wrap;
    row-gap: var(--esmera-space-4);
  }

  .esmera-sales-command-bar .esmera-command-bar__copy {
    flex: 1 1 520px;
  }

  .esmera-sales-command-bar .esmera-command-bar__actions {
    margin-left: auto;
  }
}

'''
marker = '@media (max-width: 560px) {'
if text.count(marker) != 1:
    raise RuntimeError(f'sale-create-dialog.scss: expected one mobile marker, found {text.count(marker)}')
path.write_text(text.replace(marker, addition + marker, 1), encoding='utf-8')

print('Creation header refinements applied.')
