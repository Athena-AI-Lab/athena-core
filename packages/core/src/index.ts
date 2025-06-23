import {
  createWorkflow, workflowEvent
} from '@llama-flow/core'
import {
  pluginRegisterEvent,
  pluginStateAsyncContext,
  Plugin,
  PluginState,
  pluginUnregisterEvent
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

export function createAthena (): AthenaConfig {
  const coreWorkflow = createWorkflow()
  const pluginSet = new Set<Plugin>()
  const pluginStateMap = new WeakMap<Plugin, PluginState>()
  const { sendEvent, stream } = coreWorkflow.createContext()
  // one trick to keep the latest stream
  let latest = stream

  async function waitFn (handler: (s: typeof stream) => Promise<unknown>) {
    const [l, r] = latest.tee()
    await handler(l)
    latest = r
  }

  coreWorkflow.handle([pluginRegisterEvent], () => {
    pluginSet.values().every((plugin) => {
      const pluginState = pluginStateMap.get(plugin)!
      const cleanup = pluginStateAsyncContext.run(pluginState,
        () => plugin.setup())
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

  const config: AthenaConfig = {
    add: (plugin: Plugin) => {
      pluginSet.add(plugin)
      const pluginState: PluginState = {
        description: '',
        tools: new Map(),
        get context() {
          return {
            sendEvent,
            handle: coreWorkflow.handle,
            wait: waitFn
          }
        }
      }
      pluginStateMap.set(plugin, pluginState)
      return config
    },
    run: () => {
      sendEvent(pluginRegisterEvent.with())
      return {
        get plugins (): ReadonlySet<Plugin> {
          return new Set(pluginSet)
        },
        async stop (): Promise<void> {
          await waitFn(s => s.until(haltEvent).toArray())
          sendEvent(pluginUnregisterEvent.with())
          await waitFn(s => s.until(haltEvent).toArray())
        }
      }
    }
  }
  return config
}