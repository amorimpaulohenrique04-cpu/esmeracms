import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('loads the Esmera operational dashboard and final shell', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')
    await expect(page).toHaveURL('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeVisible()
    await expect(page.getByTestId('esmera-app-header')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Olá, Esméra/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Conteúdo do site' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Pipeline', exact: true })).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('lang', /^pt/)
  })

  test('opens the authenticated command palette', async () => {
    await page.goto('http://localhost:3000/admin')
    await page.getByRole('button', { name: 'Buscar no CMS' }).click()
    await expect(page.getByTestId('esmera-command-palette')).toBeVisible()
    await expect(page.getByText('Abrir Dashboard', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('esmera-command-palette')).toBeHidden()
  })

  test('keeps pipeline as a view inside Sales and redirects the legacy route', async () => {
    await page.goto('http://localhost:3000/admin/pipeline')
    await expect(page).toHaveURL(/\/admin\/sales\?view=pipeline$/)
    await expect(page.getByRole('heading', { name: 'Vendas' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pipeline', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('uses a compact navigation rail at the 1024px boundary', async () => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeHidden()
    const navWidth = await page.getByTestId('esmera-nav').evaluate((element) => Math.round(element.getBoundingClientRect().width))
    expect(navWidth).toBeLessThanOrEqual(72)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('uses the Esmera mobile drawer instead of leaving the sidebar behind content', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeHidden()
    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await expect(page.getByTestId('esmera-mobile-nav')).toBeVisible()
    await expect(page.getByTestId('esmera-mobile-nav').getByRole('link', { name: 'Dashboard' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('lets operational workspaces use available width and respond to their own container', async () => {
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.goto('http://localhost:3000/admin')

    const desktopWorkspace = await page.locator('.esmera-view').evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        width: element.getBoundingClientRect().width,
        maxWidth: style.maxWidth,
        containerType: style.containerType,
      }
    })

    expect(desktopWorkspace.width).toBeGreaterThan(1500)
    expect(desktopWorkspace.maxWidth).toBe('none')
    expect(desktopWorkspace.containerType).toBe('inline-size')

    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('http://localhost:3000/admin')
    const tabletColumns = await page.locator('.esmera-metric-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)
    expect(tabletColumns).toBe(2)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/admin')
    const mobileColumns = await page.locator('.esmera-metric-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(mobileColumns).toBe(1)
    expect(overflow).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('keeps every operational workspace inside the document viewport on tablet and mobile', async () => {
    const routes = [
      '/admin',
      '/admin/products',
      '/admin/categories',
      '/admin/customers',
      '/admin/sales?view=list',
      '/admin/sales?view=pipeline',
      '/admin/after-sales',
      '/admin/reports',
      '/admin/settings',
    ]

    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      for (const route of routes) {
        await page.goto(`http://localhost:3000${route}`)
        await expect(page.locator('.esmera-view')).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${route} should not create document-level horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1)
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('operates Products as list/grid workspace with draft autosave and server readiness', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const stamp = Date.now()
    const title = `Produto E2E ${stamp}`
    const create = await page.request.post('http://localhost:3000/api/products?draft=true', {
      data: {
        title,
        code: `E2E-${stamp}`,
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'inquiry',
        _status: 'draft',
      },
    })
    expect(create.ok(), `draft product create failed: ${create.status()} ${await create.text()}`).toBeTruthy()
    const created = await create.json() as { id?: string | number; doc?: { id?: string | number } }
    const productId = created.id ?? created.doc?.id
    expect(productId).toBeTruthy()

    await page.goto('http://localhost:3000/admin/products')
    await expect(page.getByRole('heading', { name: 'Produtos' }).first()).toBeVisible()
    await expect(page.getByRole('table', { name: 'Produtos do catálogo' })).toBeVisible()
    await expect(page.getByRole('link', { name: title }).first()).toBeVisible()

    await page.getByRole('link', { name: 'Grid', exact: true }).click()
    await expect(page).toHaveURL(/view=grid/)
    await expect(page.getByRole('link', { name: title }).first()).toBeVisible()

    await page.goto(`http://localhost:3000/admin/products?product=${productId}&tab=overview`)
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mídia', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Comercial', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Variantes', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ficha técnica', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'SEO', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Histórico', exact: true })).toBeVisible()
    await expect(page.getByText('Com pendências').first()).toBeVisible()

    await page.getByLabel('Subtítulo').fill('Rascunho salvo automaticamente')
    await expect(page.getByText('Rascunho salvo', { exact: true })).toBeVisible({ timeout: 10_000 })

    const publish = await page.request.post('http://localhost:3000/api/admin-products', {
      data: { action: 'publish', ids: [productId] },
    })
    expect(publish.status()).toBe(422)
    const publishBody = await publish.json() as { updated?: number; errors?: Array<{ message?: string }> }
    expect(publishBody.updated).toBe(0)
    expect(publishBody.errors?.length).toBeGreaterThan(0)

    await page.goto(`http://localhost:3000/admin/products?product=${productId}&tab=media`)
    await expect(page.getByRole('heading', { name: 'Galeria' })).toBeVisible()
    await expect(page.getByText('Galeria vazia')).toBeVisible()
  })

  test('operates Categories as hierarchy-safe master-detail with derived products', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const stamp = Date.now()
    const parentTitle = `Categoria Pai ${stamp}`
    const childTitle = `Categoria Filha ${stamp}`
    const synonym = `sinonimo-${stamp}`

    const parentCreate = await page.request.post('http://localhost:3000/api/categories?draft=true', {
      data: {
        title: parentTitle,
        slug: `categoria-pai-${stamp}`,
        status: 'active',
        order: 100,
        _status: 'draft',
      },
    })
    expect(parentCreate.ok(), `parent category create failed: ${parentCreate.status()} ${await parentCreate.text()}`).toBeTruthy()
    const parentBody = await parentCreate.json() as { id?: string | number; doc?: { id?: string | number } }
    const parentId = parentBody.id ?? parentBody.doc?.id
    expect(parentId).toBeTruthy()

    const childCreate = await page.request.post('http://localhost:3000/api/categories?draft=true', {
      data: {
        title: childTitle,
        slug: `categoria-filha-${stamp}`,
        status: 'active',
        order: 200,
        parent: parentId,
        description: 'Descrição inicial da categoria filha.',
        searchTerms: [{ term: synonym }],
        seo: { title: `${childTitle} · Esméra`, description: 'SEO operacional da categoria.', noIndex: false },
        _status: 'draft',
      },
    })
    expect(childCreate.ok(), `child category create failed: ${childCreate.status()} ${await childCreate.text()}`).toBeTruthy()
    const childBody = await childCreate.json() as { id?: string | number; doc?: { id?: string | number } }
    const childId = childBody.id ?? childBody.doc?.id
    expect(childId).toBeTruthy()

    const productTitle = `Produto Categoria ${stamp}`
    const relatedCreate = await page.request.post('http://localhost:3000/api/products?draft=true', {
      data: {
        title: productTitle,
        code: `CAT-${stamp}`,
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'inquiry',
        categories: [childId],
        _status: 'draft',
      },
    })
    expect(relatedCreate.ok(), `related product create failed: ${relatedCreate.status()} ${await relatedCreate.text()}`).toBeTruthy()

    await page.goto('http://localhost:3000/admin/categories?status=active')
    await expect(page.getByRole('heading', { name: 'Categorias' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: parentTitle })).toBeVisible()
    const childRow = page.getByRole('link', { name: childTitle }).locator('xpath=ancestor::li')
    await expect(childRow).toBeVisible()
    await expect(childRow.getByText('1 prod.', { exact: true })).toBeVisible()

    await page.goto(`http://localhost:3000/admin/categories?status=active&q=${encodeURIComponent(synonym)}`)
    await expect(page.getByRole('link', { name: childTitle })).toBeVisible()
    await expect(page.getByRole('link', { name: parentTitle })).toHaveCount(0)

    await page.goto('http://localhost:3000/admin/categories?status=active')
    const moveSelect = page.getByLabel(`Mover ${childTitle} para posição`)
    await moveSelect.selectOption('1')
    await expect(page.getByText('Ordem editorial salva.')).toBeVisible({ timeout: 10_000 })

    await page.goto(`http://localhost:3000/admin/categories?status=active&category=${childId}&tab=general`)
    await expect(page.getByRole('heading', { name: childTitle })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mídia & SEO' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Produtos relacionados' })).toBeVisible()
    await page.getByLabel('Descrição').fill('Descrição atualizada no workspace operacional.')
    await page.getByRole('button', { name: 'Salvar rascunho' }).click()
    await expect(page.getByText('Rascunho salvo.')).toBeVisible({ timeout: 10_000 })

    const cycle = await page.request.patch(`http://localhost:3000/api/categories/${parentId}?draft=true`, {
      data: { parent: childId, _status: 'draft' },
    })
    expect(cycle.ok()).toBeFalsy()
    expect((await cycle.text()).toLocaleLowerCase('pt-BR')).toMatch(/ciclo|principal/)

    const publishParent = await page.request.post('http://localhost:3000/api/admin-categories', { data: { action: 'publish', id: parentId } })
    expect(publishParent.ok(), `parent category publish failed: ${publishParent.status()} ${await publishParent.text()}`).toBeTruthy()
    const publishChild = await page.request.post('http://localhost:3000/api/admin-categories', { data: { action: 'publish', id: childId } })
    expect(publishChild.ok(), `child category publish failed: ${publishChild.status()} ${await publishChild.text()}`).toBeTruthy()

    await page.goto(`http://localhost:3000/admin/categories?status=active&category=${childId}&tab=media`)
    await expect(page.getByText('Taxonomia & sinônimos')).toBeVisible()
    await expect(page.getByText(synonym, { exact: true })).toBeVisible()
    await expect(page.getByLabel('Preview básico de snippet')).toBeVisible()

    await page.goto(`http://localhost:3000/admin/categories?status=active&category=${childId}&tab=products`)
    await expect(page.getByRole('table', { name: 'Produtos relacionados à categoria' })).toBeVisible()
    await expect(page.getByRole('link', { name: productTitle })).toBeVisible()
    await expect(page.getByText('Esta lista vem de')).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`http://localhost:3000/admin/categories?status=active&category=${childId}&tab=general`)
    await expect(page.getByRole('link', { name: '← Categorias' })).toBeVisible()
    await expect(page.locator('.esmera-category-master')).toBeHidden()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('can navigate to the technical users list', async () => {
    await page.goto('http://localhost:3000/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users(?:\?.*)?$/)
    await expect(page.getByRole('heading', { name: /Usuários/i }).first()).toBeVisible()
    await expect(page.getByTestId('esmera-app-header')).toBeVisible()
  })

  test('can navigate to a user edit view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users/create')
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('operational reports never render placeholder traffic metrics', async () => {
    await page.goto('http://localhost:3000/admin/reports')
    await expect(page.getByText('Nenhum percentual é fixo.')).toBeVisible()
    await expect(page.getByText('15%')).toHaveCount(0)
  })
})
