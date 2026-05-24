/**
 * MCP Client - Connect to external MCP servers as a client
 * 
 * This module provides MCPClient and MCPClientPool classes that allow
 * TodoList to connect to external MCP servers and call their tools.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createStdioTransport, createHttpTransport } from './client-transport.js'
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { withRetry, DEFAULT_RETRY_CONFIG } from './retry'
import type { RetryConfig } from './retry'

export interface MCPClientConfig {
  name: string
  command?: string
  args?: string[]
  url?: string
  transport: 'stdio' | 'http'
}

export interface RemoteTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * MCPClient - Wraps an MCP client connection to a remote server
 */
export class MCPClient {
  private client: Client | null = null
  private name: string
  private transportType: 'stdio' | 'http'
  private stdioTransport: StdioClientTransport | null = null
  private httpTransport: StreamableHTTPClientTransport | null = null

  constructor(config: MCPClientConfig) {
    this.name = config.name
    this.transportType = config.transport
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.client) {
      return // Already connected
    }

    if (this.transportType === 'stdio') {
      // For stdio transport, we need command and args from config
      // The actual connection is done when callTool/listTools is invoked
      this.client = new Client({
        name: 'todo-list-mcp-client',
        version: '1.0.0',
      })
    } else {
      throw new Error('HTTP transport requires URL configuration')
    }
  }

  /**
   * Connect using stdio transport with a specific command
   */
  async connectStdio(command: string, args: string[] = []): Promise<void> {
    if (this.client) {
      await this.disconnect()
    }

    this.stdioTransport = createStdioTransport(command, args)
    this.client = new Client({
      name: 'todo-list-mcp-client',
      version: '1.0.0',
    })

    await this.client.connect(this.stdioTransport)
  }

  /**
   * Connect using HTTP transport with a specific URL (with retry)
   */
  async connectHttp(url: string, retryConfig?: RetryConfig): Promise<void> {
    if (this.client) {
      await this.disconnect()
    }

    this.httpTransport = createHttpTransport(url)
    this.client = new Client({
      name: 'todo-list-mcp-client',
      version: '1.0.0',
    })

    await withRetry(
      () => this.client!.connect(this.httpTransport),
      retryConfig ?? DEFAULT_RETRY_CONFIG
    )
  }

  /**
   * Check if transport is healthy (basic connectivity check)
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false
    try {
      await withRetry(
        () => this.client!.request(ListToolsRequestSchema, {}),
        { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 }
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.stdioTransport = null
      this.httpTransport = null
    }
  }

  /**
   * List available tools from the connected MCP server
   */
  async listTools(): Promise<RemoteTool[]> {
    if (!this.client) {
      throw new Error('Client not connected')
    }

    const response = await this.client.request(
      ListToolsRequestSchema,
      {}
    )

    return response.tools || []
  }

  /**
   * Call a tool on the connected MCP server (with retry)
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    retryConfig?: RetryConfig
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    if (!this.client) {
      throw new Error('Client not connected')
    }

    const result = await withRetry(
      () => this.client!.request(
        CallToolRequestSchema,
        { name: toolName, arguments: args }
      ),
      retryConfig ?? DEFAULT_RETRY_CONFIG
    )

    return result as { content: Array<{ type: string; text: string }>; isError?: boolean }
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.client !== null
  }

  /**
   * Get the client name
   */
  getName(): string {
    return this.name
  }
}

/**
 * MCPClientPool - Singleton for managing multiple external MCP server connections
 */
export class MCPClientPool {
  private clients: Map<string, MCPClient> = new Map()
  private static instance: MCPClientPool

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): MCPClientPool {
    if (!MCPClientPool.instance) {
      MCPClientPool.instance = new MCPClientPool()
    }
    return MCPClientPool.instance
  }

  /**
   * Add a new client connection to the pool
   */
  async addClient(config: MCPClientConfig): Promise<void> {
    const client = new MCPClient(config)

    if (config.transport === 'stdio' && config.command) {
      await client.connectStdio(config.command, config.args || [])
    } else if (config.transport === 'http' && config.url) {
      await client.connectHttp(config.url)
    } else {
      await client.connect()
    }

    this.clients.set(config.name, client)
  }

  /**
   * Remove a client connection from the pool
   */
  async removeClient(name: string): Promise<void> {
    const client = this.clients.get(name)
    if (client) {
      await client.disconnect()
      this.clients.delete(name)
    }
  }

  /**
   * Get a client by name
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name)
  }

  /**
   * List all connected client names
   */
  listClients(): string[] {
    return Array.from(this.clients.keys())
  }

  /**
   * Call a tool on a specific client
   */
  async callTool(
    clientName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const client = this.clients.get(clientName)
    if (!client) {
      throw new Error(`Client "${clientName}" not found`)
    }
    return client.callTool(toolName, args)
  }

  /**
   * List tools available on a specific client
   */
  async listTools(clientName: string): Promise<RemoteTool[]> {
    const client = this.clients.get(clientName)
    if (!client) {
      throw new Error(`Client "${clientName}" not found`)
    }
    return client.listTools()
  }
}

// Export singleton instance
export const mcpClientPool = MCPClientPool.getInstance()

export default {
  MCPClient,
  MCPClientPool,
  mcpClientPool,
}