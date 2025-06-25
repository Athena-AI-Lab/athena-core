import {
  createWorkflow,
  Workflow,
  workflowEvent,
  WorkflowContext
} from '@llama-flow/core'
import {
  pluginRegisterEvent,
  pluginStateAsyncContext,
  Plugin,
  PluginState,
  pluginUnregisterEvent,
  AthenaTool
} from './plugin.js'

export type AthenaConfig = {
  add (plugin: Plugin): AthenaConfig;
  run (): Athena
}

export type Athena = {
  get plugins (): ReadonlySet<Plugin>
  stop (): Promise<void>
}

const haltEvent = workflowEvent()

export const toolCallEvent = workflowEvent<{
  id: string;
  name: string;
  args: Record<string, any>;
}>()
export const toolResultEvent = workflowEvent<{
  id: string;
  name: string;
  args: Record<string, any>;
  result: any;
}>()

export interface AthenaContext {
  handle: Workflow['handle'];
  sendEvent: WorkflowContext['sendEvent'];
  waitFor (handler: (stream: WorkflowContext['stream']) => Promise<unknown>): Promise<void>
}

export function createAthena (): AthenaConfig {
  const coreWorkflow = createWorkflow()
  const toolsMap = new Map<string, AthenaTool>()
  const pluginSet = new Set<Plugin>()
  const pluginStateMap = new WeakMap<Plugin, PluginState>()
  let sendEvent: WorkflowContext['sendEvent']
  // one trick to keep the latest stream
  let latest: WorkflowContext['stream']

  async function waitFor (handler: (s: WorkflowContext['stream']) => Promise<unknown>) {
    const [l, r] = latest.tee()
    await handler(l)
    latest = r
  }

  coreWorkflow.handle([pluginRegisterEvent], () => {
    pluginSet.values().every((plugin) => {
      const pluginState = pluginStateMap.get(plugin)!
      const cleanup = pluginStateAsyncContext.run(pluginState,
        () => plugin.setup({})
      )
      if (cleanup) {
        pluginState.cleanup = cleanup
      }
    })
    return haltEvent.with()
  })

  coreWorkflow.handle([pluginUnregisterEvent], () => {
    pluginSet.values().every((plugin) => {
      const pluginState = pluginStateMap.get(plugin)!
      if (pluginState.cleanup) {
        pluginState.cleanup()
      }
    })
    return haltEvent.with()
  })

  coreWorkflow.handle([toolCallEvent], async ({ data }) => {
    const tool = toolsMap.get(data.name)
    if (!tool) {
      throw new Error(`Tool "${data.name}" not found`)
    }
    const result: any = await tool.fn.call(null, data.args as any)
    return toolResultEvent.with({
      id: data.id,
      name: data.name,
      args: data.args,
      result
    })
  })

  let context: AthenaContext | null = null

  const config: AthenaConfig = {
    add: (plugin) => {
      pluginSet.add(plugin)
      const pluginState: PluginState = {
        get name() {
          return plugin.name
        },
        epoch: 0,
        description: null,
        get config () {
          // todo: read from yaml file
          return {}
        },
        get tools () {
          return toolsMap
        },
        get athenaContext () {
          return context!
        }
      }
      pluginStateMap.set(plugin, pluginState)
      return config
    },
    run: () => {
      ({ sendEvent, stream: latest } = coreWorkflow.createContext())
      context = Object.freeze({
        sendEvent,
        handle: coreWorkflow.handle,
        waitFor
      })
      sendEvent(pluginRegisterEvent.with())
      return {
        get context(): AthenaContext {
          return context!
        },
        get tools (): ReadonlyMap<string, AthenaTool> {
          return toolsMap
        },
        get plugins (): ReadonlySet<Plugin> {
          return new Set(pluginSet)
        },
        async stop (): Promise<void> {
          await context!.waitFor(s => s.until(haltEvent).toArray())
          sendEvent(pluginUnregisterEvent.with())
          await context!.waitFor(s => s.until(haltEvent).toArray())
        }
      }
    }
  }
  return config
}