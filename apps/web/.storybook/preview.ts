import { withThemeByClassName } from "@storybook/addon-themes"
import type { Preview, Renderer } from "@storybook/nextjs-vite"
import "../src/app/globals.css"
import { themeConfig } from "../src/config/theme.config"
import { generateThemeCSS } from "../src/lib/theme"

// Inject theme CSS so CSS custom properties resolve correctly in stories.
// This mirrors what layout.tsx does in the app.
if (typeof document !== "undefined") {
  const existing = document.getElementById("eggscaliber-theme")
  if (!existing) {
    const style = document.createElement("style")
    style.id = "eggscaliber-theme"
    style.textContent = generateThemeCSS(themeConfig)
    document.head.appendChild(style)
  }
}

const preview: Preview = {
  decorators: [
    withThemeByClassName<Renderer>({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
}

export default preview
