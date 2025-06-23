import {
  createWorkflow,
  Workflow,
  WorkflowEvent,
  workflowEvent,
  eventSource,
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

export function createAthena (): AthenaConfig {
  const coreWorkflow = createWorkflow()
  const toolsMap = new Map()
  const pluginSet = new Set<Plugin>()
  const pluginStateMap = new WeakMap<Plugin, PluginState>()
  let sendEvent: WorkflowContext['sendEvent']
  // one trick to keep the latest stream
  let latest: WorkflowContext['stream']

  async function waitFn (handler: (s: WorkflowContext['stream']) => Promise<unknown>) {
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
          return {
            get stream() {
              const [l, r] = latest.tee()
              latest = r
              return l.filter(
                ev =>
                  eventSource(ev) !== pluginRegisterEvent &&
                  eventSource(ev) !== pluginUnregisterEvent
              );
            },
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
      ({ sendEvent, stream: latest } = coreWorkflow.createContext())
      sendEvent(pluginRegisterEvent.with())
      return {
        get tools (): ReadonlyMap<string, AthenaTool> {
          return toolsMap
        },
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