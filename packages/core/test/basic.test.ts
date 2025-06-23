import { expect, test, vi } from 'vitest'
import { createAthena } from '../src/index.js'
import {
  onRegister,
  onUnregister,
  Plugin,
  useDescription
} from '../src/plugin.js'

test('should able to setup athena', async () => {
  const registerHandler = vi.fn()
  const unregisterHandler = vi.fn()
  const noopPlugin: Plugin = {
    setup () {
      useDescription('this plugin does nothing')
      onRegister(registerHandler)
      onUnregister(unregisterHandler)
    }
  }
  const athena = createAthena().add(noopPlugin).run()
  expect(registerHandler).toHaveBeenCalledOnce()
  await athena.stop()
  expect(unregisterHandler).toHaveBeenCalledOnce()
})
