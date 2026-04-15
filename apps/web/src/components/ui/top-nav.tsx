"use client"

import { Moon, Sun } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { themeConfig } from "@/config/theme.config"

const NAV_LINKS = [{ href: "/analytics", label: "Analytics" }]

export function TopNav() {
  const pathname = usePathname()
  const { setTheme } = useTheme()

  return (
    <nav className="flex h-12 shrink-0 items-center gap-4 bg-nav px-4 text-white">
      <span className="text-sm font-bold tracking-tight">{themeConfig.brand.name}</span>
      <div className="flex gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname?.startsWith(href) ?? false
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
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
              className="text-white hover:bg-white/15 hover:text-white"
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
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-white/20 text-[10px] font-bold text-white">
            MP
          </AvatarFallback>
        </Avatar>
      </div>
    </nav>
  )
}
