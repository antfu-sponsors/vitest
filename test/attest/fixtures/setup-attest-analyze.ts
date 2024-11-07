import type { GlobalSetupContext } from 'vitest/node'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from "node:path"
import { getConfig } from '@ark/attest/internal/config.js'

const config = getConfig()

// TODO(attest): for now we use cli since running `setup` repeatedly doesn't work
// (probably ts server fs in memory is stale and we can invalidate on re-run via vfs.updateFile?)
// import { setup } from "@ark/attest";

async function setup2() {
  mkdirSync('.attest/assertions', { recursive: true })
  const binFile = path.resolve('../node_modules/.bin/attest')
  console.log(binFile, existsSync(binFile));
  execFileSync(binFile, ['precache', '.attest/assertions/typescript.json'], {
    stdio: 'inherit',
  })
}

export default async (_ctx: GlobalSetupContext) => {
  if (config.skipTypes) {
    return
  }

  await setup2()

  // TODO: re-run setup
  // ctx.onWatcherRerun(async () => {
  //   await setup2();
  // });
}
