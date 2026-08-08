/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation.js'
import { getPayload } from 'payload'

import { customAdminLoginURL, isPrivateCustomAdminView } from '../../../../admin/auth/customViewGuard'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = async ({ params, searchParams }: Args) => {
  const [payloadConfig, resolvedParams, resolvedSearchParams] = await Promise.all([
    config,
    params,
    searchParams,
  ])

  if (isPrivateCustomAdminView(resolvedParams.segments, payloadConfig.admin.components.views)) {
    const payload = await getPayload({ config: payloadConfig })
    const { user } = await payload.auth({ headers: await getHeaders() })

    if (!user) {
      redirect(customAdminLoginURL({
        adminRoute: payloadConfig.routes.admin,
        loginRoute: payloadConfig.admin.routes.login,
        searchParams: resolvedSearchParams,
        segments: resolvedParams.segments,
      }))
    }
  }

  return RootPage({
    config: Promise.resolve(payloadConfig),
    params: Promise.resolve(resolvedParams),
    searchParams: Promise.resolve(resolvedSearchParams),
    importMap,
  })
}

export default Page
