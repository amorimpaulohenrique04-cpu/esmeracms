from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'src/admin/modules/sales/SalesWorkspaceClient.tsx'
styles = root / 'src/admin/modules/sales/sale-create-dialog.scss'

text = source.read_text(encoding='utf-8')
replacements = [
    (
        "  const closeRef = useRef<HTMLButtonElement>(null)\n",
        "  const closeRef = useRef<HTMLButtonElement>(null)\n  const portalContainerRef = useRef<HTMLFormElement>(null)\n",
    ),
    (
        '    <form className="esmera-sales-create-form esmera-sales-close-form" onSubmit={submit}>',
        '    <form ref={portalContainerRef} className="esmera-sales-create-form esmera-sales-close-form" onSubmit={submit}>',
    ),
    (
        '''          <ComboboxPrimitive.Positioner className={comboboxClasses.positioner} sideOffset={4} align="start">
              <ComboboxPrimitive.Popup className={`${comboboxClasses.popup} esmera-sales-customer-popup`} aria-busy={searching || undefined}>''',
        '''          <ComboboxPrimitive.Portal container={portalContainerRef} className="esmera-sales-customer-portal">
            <ComboboxPrimitive.Positioner className={comboboxClasses.positioner} sideOffset={4} align="start">
              <ComboboxPrimitive.Popup className={`${comboboxClasses.popup} esmera-sales-customer-popup`} aria-busy={searching || undefined}>''',
    ),
    (
        '''              </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Root>''',
        '''              </ComboboxPrimitive.Popup>
            </ComboboxPrimitive.Positioner>
          </ComboboxPrimitive.Portal>
        </ComboboxPrimitive.Root>''',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'expected one match for {old[:80]!r}, found {count}')
    text = text.replace(old, new, 1)

source.write_text(text, encoding='utf-8')

css = styles.read_text(encoding='utf-8')
marker = '''.esmera-sales-customer-popup {
'''
addition = '''.esmera-sales-customer-portal {
  display: contents;
}

.esmera-sales-customer-popup {
'''
if css.count(marker) != 1:
    raise RuntimeError(f'expected one popup style marker, found {css.count(marker)}')
styles.write_text(css.replace(marker, addition, 1), encoding='utf-8')

print('Combobox portal anchored inside the sale dialog form.')
