/**
 * BaseTool - Abstract base class for all tools (nanobot-style)
 */

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  data?: string
  error?: string
}

/**
 * Base class for all tools in the ToolRegistry
 */
export abstract class BaseTool {
  abstract name: string
  abstract description: string
  abstract parameters: Record<string, unknown>

  /**
   * Execute the tool with given arguments
   */
  abstract execute(...args: unknown[]): Promise<string>

  /**
   * Get tool definition for LLM consumption
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    }
  }

  /**
   * Validate that required parameters are present
   */
  protected validateParams(params: Record<string, unknown>, required: string[]): void {
    for (const key of required) {
      if (params[key] === undefined || params[key] === null) {
        throw new Error(`Missing required parameter: ${key}`)
      }
    }
  }

  /**
   * Create a JSON schema for parameters
   */
  protected createSchema(
    properties: Record<string, { type: string; description: string }>,
    required: string[]
  ): Record<string, unknown> {
    return {
      type: 'object',
      properties,
      required,
    }
  }
}