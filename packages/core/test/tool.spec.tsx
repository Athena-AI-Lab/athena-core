import { test } from 'vitest'
import {
  useTool, onEvent,
  Plugin,
  useDescription
} from '../src/plugin.js'
import { createAthena } from '../src/index.js'

test('should able to add tool to plugin', async () => {
  const noopPlugin: Plugin = {
    name: 'noop',
    setup () {
      useDescription('this plugin does nothing')
      useTool(
        'example-tool', 'this tool is just an example',
        {
          args: {},
          returnVals: {
            type: 'string',
            description: 'this return value is just an example',
            required: true
          }
        },
        {
          fn: async () => 'example result'
        }
      )
      // onEvent('', () => {
      //
      // })
    }
  }
  const athena = createAthena().add(noopPlugin).run()
  await athena.stop()
})