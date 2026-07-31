import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { pt } from 'payload/i18n/pt'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Activities } from './collections/Activities'
import { AfterSales } from './collections/AfterSales'
import { Categories } from './collections/Categories'
import { Customers } from './collections/Customers'
import { Leads } from './collections/Leads'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { Sales } from './collections/Sales'
import { Tasks } from './collections/Tasks'
import { Users } from './collections/Users'
import { About } from './globals/About'
import { CollectionPage } from './globals/CollectionPage'
import { Contact } from './globals/Contact'
import { Home } from './globals/Home'
import { Navigation } from './globals/Navigation'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  i18n: {
    supportedLanguages: { pt },
    fallbackLanguage: 'pt',
  },
  admin: {
    user: Users.slug,
    theme: 'light',
    dateFormat: 'dd/MM/yyyy HH:mm',
    meta: {
      titleSuffix: ' · Esméra CMS',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      Nav: '/admin/components/Nav#EsmeraNav',
      graphics: {
        Icon: '/admin/components/Brand#EsmeraIcon',
        Logo: '/admin/components/Brand#EsmeraLogo',
      },
      views: {
        dashboard: {
          Component: '/admin/views/Dashboard',
        },
        content: {
          Component: '/admin/views/SiteViews#ContentView',
          path: '/content',
        },
        products: {
          Component: '/admin/views/SiteViews#ProductsView',
          path: '/products',
        },
        categories: {
          Component: '/admin/views/SiteViews#CategoriesView',
          path: '/categories',
        },
        customers: {
          Component: '/admin/views/BusinessViews#CustomersView',
          path: '/customers',
        },
        sales: {
          Component: '/admin/views/BusinessViews#SalesView',
          path: '/sales',
        },
        pipeline: {
          Component: '/admin/views/BusinessViews#PipelineView',
          path: '/pipeline',
        },
        afterSales: {
          Component: '/admin/views/BusinessViews#AfterSalesView',
          path: '/after-sales',
        },
        reports: {
          Component: '/admin/views/BusinessViews#ReportsView',
          path: '/reports',
        },
        settings: {
          Component: '/admin/views/SiteViews#SettingsView',
          path: '/settings',
        },
        technical: {
          Component: '/admin/views/SiteViews#TechnicalView',
          path: '/technical',
        },
      },
    },
  },
  collections: [
    Users,
    Media,
    Categories,
    Products,
    Leads,
    Customers,
    Sales,
    AfterSales,
    Tasks,
    Activities,
  ],
  globals: [
    Home,
    About,
    Contact,
    CollectionPage,
    Navigation,
    SiteSettings,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
