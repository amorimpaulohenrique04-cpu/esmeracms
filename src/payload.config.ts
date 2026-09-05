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
import { foldKey } from './businessRules/products/importValidation'
import { Activities } from './collections/Activities'
import { AfterSales } from './collections/AfterSales'
import { Categories } from './collections/Categories'
import { ClientInterests } from './collections/ClientInterests'
import { Customers } from './collections/Customers'
import { Leads } from './collections/Leads'
import { Media } from './collections/Media'
import { Occurrences } from './collections/Occurrences'
import { Opportunities } from './collections/Opportunities'
import { ProductImports } from './collections/ProductImports'
import { Products } from './collections/Products'
import { Reservations } from './collections/Reservations'
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
import { parseDecoCorsOrigins } from './server/env/cors'
import { requireDatabaseURL } from './server/env/postgres'
import { canRunEsmeraJobs, esmeraJobTasks } from './server/jobs'
import { ProductImportJob } from './server/jobs/productImport'
import { GenerateReportExportJob } from './server/jobs/reportExport'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const payloadSecret = process.env.PAYLOAD_SECRET || ''
const databaseURL = requireDatabaseURL()
const isTest = process.env.NODE_ENV === 'test'
const isProduction = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1'

if (isProduction && payloadSecret.length < 24) {
  throw new Error('PAYLOAD_SECRET deve possuir pelo menos 24 caracteres em produção.')
}

const validateActiveProductCategories = withActiveProductCategoryValidity(Products.hooks?.beforeValidate || [])

const OperationalProducts = {
  ...Products,
  hooks: {
    ...Products.hooks,
    beforeValidate: [
      async (args) => {
        const data = await validateActiveProductCategories(args)
        if (!data) return data
        const code = data.code ?? args.originalDoc?.code
        if (code) data.codeNormalized = foldKey(String(code))
        return data
      },
    ],
  },
  fields: [
    ...Products.fields,
    {
      name: 'codeNormalized',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
    },
  ],
} satisfies CollectionConfig

const OperationalCategories = {
  ...Categories,
  hooks: {
    ...Categories.hooks,
    beforeValidate: [
      ...(Categories.hooks?.beforeValidate || []),
      ({ data, originalDoc }) => {
        if (!data) return data
        const title = data.title ?? originalDoc?.title
        if (title) data.titleNormalized = foldKey(String(title))
        return data
      },
    ],
  },
  fields: [
    ...Categories.fields,
    {
      name: 'titleNormalized',
      type: 'text',
      index: true,
      admin: { hidden: true },
    },
  ],
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
      providers: [
        '/admin/state/AdminStateProvider#AdminStateProvider',
        '/admin/navigation/NavigationFeedbackProvider#NavigationFeedbackProvider',
      ],
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
        leads: {
          Component: '/admin/modules/leads/LeadsView#LeadsView',
          path: '/leads',
        },
        opportunities: {
          Component: '/admin/modules/sales/SalesViews#SalesWorkspace',
          path: '/opportunities',
        },
        sales: {
          Component: '/admin/modules/sales/SalesConfirmedView#SalesConfirmedView',
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
    tasks: [...esmeraJobTasks, GenerateReportExportJob, ProductImportJob],
    enableConcurrencyControl: true,
    // Payload autorun is intended for a dedicated persistent worker. On Vercel
    // every warm serverless instance could otherwise schedule the same queues.
    shouldAutoRun: async () => !isVercel && process.env.PAYLOAD_JOBS_AUTORUN === 'true',
    autoRun: [
      { cron: '* * * * *', queue: 'operational', limit: 25 },
      { cron: '*/5 * * * *', queue: 'integrations', limit: 10 },
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
    OperationalCategories,
    OperationalProducts,
    ProductImports,
    Reservations,
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
    push: !isProduction,
    pool: {
      connectionString: databaseURL,
      // Vercel escala horizontalmente; limitar cada instância de produção a
      // uma conexão evita multiplicar o pool até esgotar o limite do Postgres.
      // Os testes continuam com pool maior para o bootstrap do Payload.
      max: isTest ? 20 : isProduction ? 1 : 5,
      idleTimeoutMillis: isProduction ? 5_000 : 10_000,
      connectionTimeoutMillis: isTest ? 30_000 : isProduction ? 15_000 : 5_000,
      allowExitOnIdle: isProduction,
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
