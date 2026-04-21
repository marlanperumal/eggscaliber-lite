import type { ReactNode } from "react"

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
