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
import { getRegistry } from './registry'

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

// Initialize registry with all tools
const registry = getRegistry()
registry.registerAll([
  { tool: allTools.find(t => t.name === 'list-tasks')!, requiredRole: 'reader' },
  { tool: allTools.find(t => t.name === 'create-task')!, requiredRole: 'operator' },
  { tool: allTools.find(t => t.name === 'update-task')!, requiredRole: 'operator' },
  { tool: allTools.find(t => t.name === 'delete-task')!, requiredRole: 'admin' },
  { tool: allTools.find(t => t.name === 'complete-task')!, requiredRole: 'operator' },
  { tool: allTools.find(t => t.name === 'query-by-tag')!, requiredRole: 'reader' },
  { tool: allTools.find(t => t.name === 'get-task')!, requiredRole: 'reader' },
])

// Register the tools - expose via /tools/list endpoint using registry
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = registry.listTools()
  return {
    tools: tools.map(tool => ({
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
