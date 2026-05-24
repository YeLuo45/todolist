/**
 * MCP Server - Main server file using @modelcontextprotocol/sdk
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { allTools, toolsByName } from './tools'
import type { McpRequest } from './types'

// Initialize the MCP server
const server = new Server(
  {
    name: 'todo-list-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Register the tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  const tool = toolsByName[name]
  if (!tool) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: `Tool "${name}" not found` }, null, 2),
        },
      ],
      isError: true,
    }
  }

  try {
    const result = await tool.handler(args as Record<string, unknown>)
    return result
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    }
  }
})

// Main entry point
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[MCP Server] TodoList MCP Server started on stdio')
}

// Run the server
main().catch((error) => {
  console.error('[MCP Server] Failed to start:', error)
  process.exit(1)
})

export { server }