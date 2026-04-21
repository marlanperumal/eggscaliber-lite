import path from "node:path"
import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/nextjs-vite"
import tailwindcss from "@tailwindcss/vite"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../public"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/nextjs-vite",
  viteFinal: async (config) => {
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    config.resolve = {
      ...config.resolve,
      alias: {
        ...((config.resolve as any)?.alias ?? {}),
        "@clerk/nextjs": path.resolve(__dirname, "./mocks/clerk.tsx"),
      },
    }
    config.define = {
      ...config.define,
      __dirname: JSON.stringify("/"),
    }
    config.build = {
      ...config.build,
      rolldownOptions: {
        ...(config.build as any)?.rolldownOptions,
        treeshake: false,
      },
    }
    return config
  },
}

export default config
