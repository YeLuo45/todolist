/**
 * MCP Client Transport Factory
 * 
 * Creates transport instances for connecting to external MCP servers.
 * Supports stdio (local subprocess) and HTTP transports.
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * Create a stdio-based transport for connecting to a local MCP server subprocess.
 * @param command - The command to run (e.g., 'node', 'python')
 * @param args - Arguments to pass to the command
 * @returns StdioClientTransport instance
 */
export function createStdioTransport(
  command: string,
  args: string[] = []
): StdioClientTransport {
  return new StdioClientTransport({
    command,
    args,
  })
}

/**
 * Create an HTTP-based transport for connecting to a remote MCP server.
 * @param url - The HTTP endpoint URL of the MCP server
 * @returns StreamableHTTPClientTransport instance
 */
export function createHttpTransport(url: string): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(url))
}

export default {
  createStdioTransport,
  createHttpTransport,
}