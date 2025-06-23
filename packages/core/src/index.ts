import {
  createWorkflow, workflowEvent
} from '@llama-flow/core'
import {
  pluginRegisterEvent,
  workflowAsyncContext,
  Plugin,
  PluginState, pluginUnregisterEvent
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
  coreWorkflow.handle([pluginRegisterEvent], (pluginRegister) => {
    pluginSet.values().every((plugin) => {
      const pluginState = pluginStateMap.get(plugin)!
      const pluginWorkflow = pluginState.workflow
      const { sendEvent } = pluginWorkflow.createContext()
      sendEvent(pluginRegister)
    })
    return haltEvent.with()
  })
  coreWorkflow.handle([pluginUnregisterEvent], (pluginUnregister) => {
    pluginSet.values().every((plugin) => {
      const pluginState = pluginStateMap.get(plugin)!
      const pluginWorkflow = pluginState.workflow
      const { sendEvent } = pluginWorkflow.createContext()
      sendEvent(pluginUnregister)
    })
    return haltEvent.with()
  })

  const config: AthenaConfig = {
    add: (plugin: Plugin) => {
      pluginSet.add(plugin)
      const pluginWorkflow = createWorkflow()
      const pluginState: PluginState = {
        description: null!,
        workflow: pluginWorkflow
      }
      workflowAsyncContext.run(pluginState, () => plugin.setup())
      pluginStateMap.set(plugin, pluginState)
      return config
    },
    run: () => {
      const { sendEvent, stream: registerStream } = coreWorkflow.createContext()
      sendEvent(pluginRegisterEvent.with())
      return {
        get plugins (): ReadonlySet<Plugin> {
          return new Set(pluginSet)
        },
        async stop (): Promise<void> {
          await registerStream.until(haltEvent).toArray()
          const {
            sendEvent,
            stream: unregisterStream
          } = coreWorkflow.createContext()
          sendEvent(pluginUnregisterEvent.with())
          await unregisterStream.until(haltEvent).toArray()
        }
      }
    }
  }
  return config
}