/**
 * MCP Transport Adapter
 * 
 * This module provides stdio transport for the MCP server.
 * The @modelcontextprotocol/sdk handles stdio communication,
 * but this module can be extended for custom transport needs.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'

export async function createStdioTransport(): Promise<StdioServerTransport> {
  return new StdioServerTransport()
}

export async function connectServer(server: Server): Promise<void> {
  const transport = await createStdioTransport()
  await server.connect(transport)
}

export class NodeStreamTransport {
  // Placeholder for future WebSocket or other transport implementations
  // Currently stdio is the only required transport per the task requirements
}

export default { createStdioTransport, connectServer }