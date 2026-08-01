import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type CollectionConfig } from 'payload'
import { pt } from 'payload/i18n/pt'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { withActiveProductCategoryValidity } from './businessRules/products/categoryValidity'
import { Activities } from './collections/Activities'
import { AfterSales } from './collections/AfterSales'
import { Categories } from './collections/Categories'
import { ClientInterests } from './collections/ClientInterests'
import { Customers } from './collections/Customers'
import { Leads } from './collections/Leads'
import { Media } from './collections/Media'
import { Occurrences } from './collections/Occurrences'
import { Opportunities } from './collections/Opportunities'
import { Products } from './collections/Products'
import { Sales } from './collections/Sales'
import { Shipments } from './collections/Shipments'
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

const OperationalProducts = {
  ...Products,
  hooks: {
    ...Products.hooks,
    beforeValidate: [withActiveProductCategoryValidity(Products.hooks?.beforeValidate || [])],
  },
} satisfies CollectionConfig

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
      header: ['/admin/shell/AppHeader#AppHeader'],
      graphics: {
        Icon: '/admin/components/Brand#EsmeraIcon',
        Logo: '/admin/components/Brand#EsmeraLogo',
      },
      views: {
        dashboard: {
          Component: '/admin/modules/dashboard/DashboardView',
        },
        products: {
          Component: '/admin/modules/products/ProductsView#ProductsView',
          path: '/products',
        },
        categories: {
          Component: '/admin/modules/categories/CategoriesView#CategoriesView',
          path: '/categories',
        },
        customers: {
          Component: '/admin/modules/customers/CustomersView#CustomersView',
          path: '/customers',
        },
        sales: {
          Component: '/admin/modules/sales/SalesViews#SalesWorkspace',
          path: '/sales',
        },
        pipelineRedirect: {
          Component: '/admin/modules/sales/SalesViews#PipelineRedirect',
          path: '/pipeline',
        },
        afterSales: {
          Component: '/admin/modules/after-sales/AfterSalesView#AfterSalesView',
          path: '/after-sales',
        },
        reports: {
          Component: '/admin/modules/reports/ReportsView#ReportsView',
          path: '/reports',
        },
        settings: {
          Component: '/admin/modules/settings/SettingsView#SettingsView',
          path: '/settings',
        },
        technical: {
          Component: '/admin/modules/technical/TechnicalView#TechnicalView',
          path: '/technical',
        },
      },
    },
  },
  collections: [
    Users,
    Media,
    Categories,
    OperationalProducts,
    Leads,
    Customers,
    ClientInterests,
    Opportunities,
    Sales,
    AfterSales,
    Tasks,
    Shipments,
    Occurrences,
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