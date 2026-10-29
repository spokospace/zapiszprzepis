import type { StaffErrorCode } from '../errors'

/**
 * How a registry entry describes itself to the MCP endpoint. The endpoint holds no
 * per-resource code: tools, their input schemas, argument checks and the SQL
 * function behind each one are all read from these descriptors. Tool and argument
 * names are a contract (BACKWARD_COMPATIBILITY.md §9), so rename nothing here
 * casually.
 */
export type ToolArgType = 'string' | 'integer' | 'boolean' | 'uuid' | 'timestamp'

export interface ToolArg {
  /** The name the MCP client sees. */
  name: string
  /** The SQL parameter it feeds (`p_user`). Omitted arguments fall back to the SQL default. */
  param: string
  type: ToolArgType
  /** English, for the model. */
  description: string
  required?: boolean
  /** Bounds for `integer`. */
  min?: number
  max?: number
  /** Upper bound for `string`. */
  maxLength?: number
  /** Allowed values for `string`. */
  values?: readonly string[]
}

export type ServiceReply = { ok: true; data: unknown } | { ok: false; code: StaffErrorCode }

/** Calls a SQL function with the service key. Only registry-declared names ever reach it. */
export type ServiceRpc = (fn: string, args: Record<string, unknown>) => Promise<ServiceReply>

export interface FinishContext {
  /** What the `_as` function returned. */
  result: unknown
  actorId: string
  tokenId: number
  rpc: ServiceRpc
}

/** A tool that reads: `<resource>_list` or `<resource>_get`. */
export interface ReadTool {
  description: string
  /** The `admin_<op>_as` function. It gets `p_actor` plus the arguments. */
  rpc: string
  args: readonly ToolArg[]
}

/** A tool that changes something: `<resource>_<operation>`. The function also gets `p_via` and `p_token_id`. */
export interface WriteTool extends ReadTool {
  /**
   * The argument naming the record this operation acts on. A dry run uses it to
   * show the record's current state through the resource's `get` tool.
   */
  target?: string
  /**
   * Work the panel does in its server action after the function returns (the import
   * retry sends its Inngest event). Runs after the audited change.
   */
  finish?: (ctx: FinishContext) => Promise<ServiceReply>
}
