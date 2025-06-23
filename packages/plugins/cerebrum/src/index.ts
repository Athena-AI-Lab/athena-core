import {
  useTool,
  definePlugin,
  useStream,
  eventSource,
  WorkflowEventData
} from '@athena/core/plugin'
import * as z from 'zod/v4'
import OpenAI from 'openai'
import image2uri from 'image2uri'
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const defaultHeaders = {
  'HTTP-Referer': 'https://athenalab.ai/',
  'X-Title': 'Athena'
}

const eventDataToPrompt = (event: WorkflowEventData<any>): string => {
  const source = eventSource(event)!
  const id = source.uniqueId
  return `<event>
<name>${id}</name>
<data>${event.data}</data>
</event>`
}

function initialPrompt (): string {
  return ''
}

const delay = 500 // milliseconds

export default definePlugin({
  name: 'cerebrum',
  config: z.object({
    base_url: z.string().describe('Amadeus API Base URL').optional(),
    api_key: z.string().describe('Amadeus API Key').optional(),
    image_supported: z.boolean().
      default(false).
      describe('Whether the plugin supports image input')
  }),
  setup ({ base_url, api_key, image_supported }) {
    const imageUrls: string[] = []
    const eventQueue: WorkflowEventData<any>[] = []
    const prompts: Array<ChatCompletionMessageParam> = []
    const openai = new OpenAI({
      baseURL: base_url,
      apiKey: api_key,
      defaultHeaders
    })
    if (image_supported) {
      useTool(
        'image-checkout',
        'Check out an image. Whenever you want to see an image, or the user asks you to see an image, use this tool.',
        {
          args: {
            image: {
              type: 'string',
              description: 'The URL or local path of the image to check out.',
              required: true
            }
          },
          returnVals: {
            type: 'string',
            description: 'The result of checking out the image.',
            required: true
          }
        },
        {
          fn: async (args) => {
            let image = args.image
            if (!image.startsWith('http')) {
              image = await image2uri(image)
            }
            imageUrls.push(image)
            return 'success'
          },
          explainArgs: (args) => ({
            summary: 'Checking out the image...',
            details: args.image
          })
        }
      )
    }
    const athenaStream = useStream()
    let timeoutSignal = AbortSignal.timeout(delay)
    athenaStream.forEach((ev) => {
      eventQueue.push(ev)
      if (timeoutSignal.aborted) {
        // process queue
        const eventsPrompts = eventQueue.slice().map(eventDataToPrompt)
        const promptSnapshot = prompts.slice()

        timeoutSignal = AbortSignal.timeout(delay)
      }
    }).catch()
    //
    // afterEventDefined((event) => {
    //   onEvent(event, async ({ data }) => {
    //
    //   })
    // })
  }
})