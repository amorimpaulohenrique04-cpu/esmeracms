const issues: string[] = []

function required(name: string, minimum = 1) {
  const value = process.env[name]?.trim() || ''
  if (value.length < minimum) issues.push(`${name} deve possuir pelo menos ${minimum} caracteres.`)
  return value
}

const databaseURL = required('DATABASE_URL', 12)
const payloadSecret = required('PAYLOAD_SECRET', 24)
const cronSecret = required('CRON_SECRET', 24)
const siteURL = required('NEXT_PUBLIC_SITE_URL', 8)
const restoreURL = required('RESTORE_TEST_DATABASE_URL', 12)
const storageDriver = required('MEDIA_STORAGE_DRIVER')

if (siteURL && !siteURL.startsWith('https://')) issues.push('NEXT_PUBLIC_SITE_URL deve usar HTTPS em produção.')
if (databaseURL && restoreURL && databaseURL === restoreURL) issues.push('RESTORE_TEST_DATABASE_URL não pode apontar para o banco de produção.')
if (payloadSecret.toLocaleLowerCase().includes('change-me')) issues.push('PAYLOAD_SECRET ainda contém um placeholder.')
if (cronSecret.toLocaleLowerCase().includes('change-me')) issues.push('CRON_SECRET ainda contém um placeholder.')

if (!['s3', 'r2'].includes(storageDriver)) {
  issues.push('MEDIA_STORAGE_DRIVER deve ser s3 ou r2 em produção.')
} else {
  required('S3_BUCKET')
  required('S3_REGION')
  required('S3_ACCESS_KEY_ID')
  required('S3_SECRET_ACCESS_KEY', 12)
  if (storageDriver === 'r2') required('S3_ENDPOINT', 8)
  if (process.env.MEDIA_STORAGE_ADAPTER_READY !== 'true') {
    issues.push('MEDIA_STORAGE_ADAPTER_READY deve ser true somente depois que o adapter remoto estiver instalado e validado no ambiente de deploy.')
  }
}

if (issues.length) {
  console.error('Gate de produção reprovado:')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exitCode = 1
} else {
  console.info('Gate de produção aprovado: banco, secrets, restore de teste e armazenamento remoto estão declarados.')
}
