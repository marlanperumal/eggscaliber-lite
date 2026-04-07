// Only Next.js-specific rules — general linting is handled by Biome
import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"

export default [...coreWebVitals, ...typescript]
