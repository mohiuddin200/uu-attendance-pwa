import { ConvexAuthProvider } from '@convex-dev/auth/react'
import type { ReactNode } from 'react'
import { convexClient } from './convexConfig'

export function ConvexRoot({ children }: { children: ReactNode }) {
  if (!convexClient) {
    return children
  }

  return <ConvexAuthProvider client={convexClient}>{children}</ConvexAuthProvider>
}
