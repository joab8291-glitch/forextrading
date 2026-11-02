import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import type { ReactNode } from 'react'
import indexCss from '../index.css?url'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Northstar FX · Forex Practice Terminal' },
      { name: 'description', content: 'Explore forex markets, practise trades and manage your account with Northstar FX.' },
      { name: 'theme-color', content: '#0a1020' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Northstar FX' },
      { property: 'og:description', content: 'Forex market practice terminal.' },
      { property: 'og:site_name', content: 'Northstar FX' },
      { property: 'og:locale', content: 'en_KE' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'stylesheet', href: indexCss }, { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}><Toaster />{children}</TooltipProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
