import type { ReactNode } from "react"

export const useOrganization = () => ({ membership: null })

export const useAuth = () => ({
  getToken: async () => null,
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
})

export const UserProfile = () => null

export const Show = ({
  children,
  fallback,
}: {
  when: string
  children: ReactNode
  fallback?: ReactNode
}) => <>{fallback}</>

export const SignInButton = ({ children }: { children: ReactNode }) => <>{children}</>

export const UserButton = () => null

export const OrganizationSwitcher = () => null
