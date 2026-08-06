from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/admin/modules/sales/SalesWorkspaceClient.tsx'
text = path.read_text(encoding='utf-8')

opening = '''          <ComboboxPrimitive.Portal>
            <ComboboxPrimitive.Positioner className={comboboxClasses.positioner} sideOffset={4} align="start">'''
opening_replacement = '''          <ComboboxPrimitive.Positioner className={comboboxClasses.positioner} sideOffset={4} align="start">'''
closing = '''            </ComboboxPrimitive.Positioner>
          </ComboboxPrimitive.Portal>'''
closing_replacement = '''          </ComboboxPrimitive.Positioner>'''

if text.count(opening) != 1:
    raise RuntimeError(f'expected one combobox portal opening, found {text.count(opening)}')
if text.count(closing) != 1:
    raise RuntimeError(f'expected one combobox portal closing, found {text.count(closing)}')

text = text.replace(opening, opening_replacement, 1)
text = text.replace(closing, closing_replacement, 1)
path.write_text(text, encoding='utf-8')

print('Customer combobox now renders inside the sale dialog subtree.')
