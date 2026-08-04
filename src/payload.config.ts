import { s3Storage } from '@payloadcms/storage-s3'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type CollectionConfig } from 'payload'
import { pt } from 'payload/i18n/pt'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { isAdmin } from './access/roles'
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
import { PublicationReceipts } from './collections/PublicationReceipts'
import { ReportExportFiles } from './collections/ReportExportFiles'
import { ReportExports } from './collections/ReportExports'
import { Sales } from './collections/Sales'
import { Shipments } from './collections/Shipments'
import { Tasks } from './collections/Tasks'
import { Users } from './collections/Users'
import { About } from './globals/About'
import { AfterSalesAutomation } from './globals/AfterSalesAutomation'
import { CollectionPage } from './globals/CollectionPage'
import { Contact } from './globals/Contact'
import { Home } from './globals/Home'
import { Navigation } from './globals/Navigation'
import { SiteSettings } from './globals/SiteSettings'
import { RecheckPublicationTask } from './jobs/recheckPublication'
import { canRunEsmeraJobs, esmeraJobTasks } from './server/jobs'
import { GenerateReportExportJob } from './server/jobs/reportExport'
import { parseDecoCorsOrigins } from './server/env/cors'
import { requireDatabaseURL } from './server/env/postgres'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const payloadSecret = process.env.PAYLOAD_SECRET || ''
const databaseURL = requireDatabaseURL()

if (process.env.NODE_ENV === 'production' && payloadSecret.length < 24) {
  throw new Error('PAYLOAD_SECRET deve possuir pelo menos 24 caracteres em produção.')
}

const OperationalProducts = {
  ...Products,
  hooks: {
    ...Products.hooks,
    beforeValidate: [withActiveProductCategoryValidity(Products.hooks?.beforeValidate || [])],
  },
} satisfies CollectionConfig

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL,
  cors: parseDecoCorsOrigins(process.env.DECO_CORS_ORIGINS),
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
      providers: ['/admin/state/AdminStateProvider#AdminStateProvider'],
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
        privacy: {
          Component: '/admin/modules/privacy/PrivacyView#PrivacyView',
          path: '/privacy',
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
  jobs: {
    access: {
      queue: ({ req }) => isAdmin(req.user),
      run: canRunEsmeraJobs,
      cancel: ({ req }) => isAdmin(req.user),
    },
    tasks: [...esmeraJobTasks, GenerateReportExportJob, RecheckPublicationTask],
    enableConcurrencyControl: true,
    shouldAutoRun: async () => process.env.PAYLOAD_JOBS_AUTORUN === 'true',
    autoRun: [
      { cron: '* * * * *', queue: 'operational', limit: 25 },
      { cron: '*/5 * * * *', queue: 'integrations', limit: 10 },
      { cron: '* * * * *', queue: 'publication-verification', limit: 10 },
    ],
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      admin: {
        ...defaultJobsCollection.admin,
        group: 'Admin técnico',
        hidden: ({ user }) => !isAdmin(user),
      },
    }),
  },
  collections: [
    Users,
    Media,
    ReportExportFiles,
    Categories,
    OperationalProducts,
    PublicationReceipts,
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
    ReportExports,
  ],
  globals: [
    Home,
    About,
    Contact,
    CollectionPage,
    Navigation,
    SiteSettings,
    AfterSalesAutomation,
  ],
  editor: lexicalEditor(),
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    push: process.env.NODE_ENV !== 'production',
    pool: {
      connectionString: databaseURL,
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      enabled: process.env.MEDIA_STORAGE_DRIVER === 'r2',
      collections: {
        media: true,
        'report-export-files': true,
      },
      bucket: process.env.S3_BUCKET || '',
      clientUploads: true,
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      },
    }),
  ],
})
