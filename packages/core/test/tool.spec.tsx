import { expect, test } from 'vitest'
import {
  useTool,
  onEvent,
  Plugin,
  useDescription,
  sendEvent,
  defineEvent
} from '../src/plugin.js'
import { createAthena } from '../src/index.js'

test('should able to add tool to plugin', async () => {
  const messageSentEvent = defineEvent<string>()
  const examplePlugin: Plugin = {
    name: 'example',
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
          fn: async () => {
            sendEvent(messageSentEvent.with('example result'))
            return 'example result'
          }
        }
      )
      onEvent(messageSentEvent, ({ data }) => {
        expect(data).toBe('example result')
      })
    }
  }
  const athena = createAthena().add(examplePlugin).run()
  await athena.stop()
})