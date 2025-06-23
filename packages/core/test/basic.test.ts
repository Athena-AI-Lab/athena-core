import { expect, test, vi } from 'vitest'
import { createAthena } from '../src/index.js'
import {
  Plugin,
  useDescription
} from '../src/plugin.js'

test('should able to setup athena', async () => {
  const cleanupHandler = vi.fn()
  const setupHandler = vi.fn(() => {
    useDescription('this plugin does nothing')
    return cleanupHandler
  })
  const noopPlugin: Plugin = {
    name: 'noop',
    setup: setupHandler
  }
  const athena = createAthena().add(noopPlugin).run()
  expect(setupHandler).toHaveBeenCalledOnce()
  await athena.stop()
  expect(cleanupHandler).toHaveBeenCalledOnce()
})
