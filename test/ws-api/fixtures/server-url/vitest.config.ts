import { defineConfig } from 'vitest/config'
import basicSsl from '@vitejs/plugin-basic-ssl'

// test https by
//   TEST_HTTPS=1 pnpm test-fixtures --root fixtures/server-url

export default defineConfig({
  plugins: [
    !!process.env.TEST_HTTPS && basicSsl(),
  ],
})
