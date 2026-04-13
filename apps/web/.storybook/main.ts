import type { StorybookConfig } from "@storybook/nextjs-vite"
import tailwindcss from "@tailwindcss/vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-mcp"],
  framework: "@storybook/nextjs-vite",
  viteFinal: async (config) => {
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    return config
  },
}

export default config
