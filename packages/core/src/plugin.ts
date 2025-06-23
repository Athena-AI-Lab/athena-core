import {
  InferWorkflowEventData,
  Workflow, WorkflowEvent,
  workflowEvent,
  WorkflowEventData
} from '@llama-flow/core'
import { AsyncLocalStorage } from 'node:async_hooks'

export type Plugin = {
  setup (): void
}

export type Tool = {
  readonly name: string;
  readonly description: string;
  readonly args: any
}

/**
 * @internal
 */
export type PluginState = {
  description: string
  workflow: Workflow
}

/**
 * @internal
 */
function usePluginState () {
  const workflow = workflowAsyncContext.getStore()
  if (!workflow) {
    throw new Error('No workflow is available in the current context')
  }
  return workflow
}

/**
 * @internal
 */
export const workflowAsyncContext = new AsyncLocalStorage<PluginState>()

/**
 * @internal
 */
export const pluginRegisterEvent = workflowEvent()

/**
 * @internal
 */
export const pluginUnregisterEvent = workflowEvent()

export function emitEvent () {

}

export function addTool () {

}

export function onEvent<Data> (
  event: WorkflowEvent<Data>,
  handler: (data: WorkflowEventData<Data>) => void | WorkflowEventData<unknown> | Promise<void> | Promise<WorkflowEventData<unknown>>
) {

}

export function useDescription (
  description: string
) {
  const pluginState = usePluginState()
  pluginState.description = description
}

export function onRegister (
  handler: (pluginRegister: WorkflowEventData<InferWorkflowEventData<typeof pluginRegisterEvent>>) => ReturnType<Workflow['handle']>
) {
  const { workflow } = usePluginState()
  workflow.handle([pluginRegisterEvent], handler)
}

export function onUnregister (
  handler: (pluginUnregister: WorkflowEventData<InferWorkflowEventData<typeof pluginUnregisterEvent>>) => void
) {
  const { workflow } = usePluginState()
  workflow.handle([pluginUnregisterEvent], handler)
}