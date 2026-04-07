import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

// Only Next.js-specific rules — general linting is handled by Biome
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
]

export default eslintConfig
