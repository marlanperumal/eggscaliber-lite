"use client"

import { OrganizationSwitcher, Show, SignInButton, UserButton } from "@clerk/nextjs"
import { useFeatureFlag } from "@posthog/next"
import { Moon, Sun } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { themeConfig } from "@/config/theme.config"

const ALL_NAV_LINKS = [
  { href: "/analytics", label: "Analytics", flag: null },
  { href: "/ai", label: "AI", flag: "ai-interface" as const },
]

export function TopNav() {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const aiFlag = useFeatureFlag("ai-interface")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const navLinks = ALL_NAV_LINKS.filter(({ flag }) => {
    if (!mounted) return flag === null
    if (flag === "ai-interface") return aiFlag?.enabled === true
    return true
  })

  return (
    <nav className="flex h-12 shrink-0 items-center gap-4 bg-nav px-4 text-nav-foreground">
      <span className="font-bold text-sm tracking-tight">{themeConfig.brand.name}</span>
      <div className="flex gap-1">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname?.startsWith(href) ?? false
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                isActive
                  ? "bg-nav-foreground/15 text-nav-foreground"
                  : "text-nav-foreground/70 hover:bg-nav-foreground/10 hover:text-nav-foreground"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle colour scheme"
              className="text-nav-foreground hover:bg-nav-foreground/15 hover:text-nav-foreground"
            >
              {/* Exception: dark: classes here are transform utilities (rotate/scale) for icon
                  animation — not colour overrides. The "no dark: overrides" rule targets
                  dark:text-* and dark:bg-* only. */}
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Show
          when="signed-in"
          fallback={
            <SignInButton mode="redirect">
              <Button
                variant="ghost"
                size="sm"
                className="text-nav-foreground hover:bg-nav-foreground/15 hover:text-nav-foreground"
              >
                Sign in
              </Button>
            </SignInButton>
          }
        >
          <OrganizationSwitcher hidePersonal />
          <UserButton userProfileUrl="/account" />
        </Show>
      </div>
    </nav>
  )
}
