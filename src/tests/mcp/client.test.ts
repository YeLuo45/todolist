/**
 * Unit tests for MCPClientPool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MCPClientPool, MCPClient } from '../../mcp/client'
import type { MCPClientConfig, RemoteTool } from '../../mcp/client'

// Mock the client-transport module
vi.mock('../../mcp/client-transport', () => ({
  createStdioTransport: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    close: vi.fn(),
    onmessage: vi.fn(),
    onerror: vi.fn(),
  })),
  createHttpTransport: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    close: vi.fn(),
    onmessage: vi.fn(),
    onerror: vi.fn(),
  })),
}))

// Mock the @modelcontextprotocol/sdk
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  // Use regular function to ensure it's a constructor
  function MockClient(opts: { name: string; version: string }) {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockResolvedValue({ tools: [] }),
      on: vi.fn(),
      off: vi.fn(),
      _opts: opts,
    }
  }
  return { Client: MockClient }
})

describe('MCPClientPool', () => {
  let pool: MCPClientPool

  beforeEach(() => {
    // Get a fresh instance for each test
    pool = MCPClientPool.getInstance()
  })

  afterEach(async () => {
    // Clean up all clients after each test
    const clientNames = pool.listClients()
    for (const name of clientNames) {
      await pool.removeClient(name)
    }
  })

  describe('addClient', () => {
    it('should add a client to the pool', async () => {
      const config: MCPClientConfig = {
        name: 'test-client-1',
        command: 'node',
        args: ['test-server.js'],
        transport: 'stdio',
      }

      await pool.addClient(config)

      expect(pool.listClients()).toContain('test-client-1')
      expect(pool.getClient('test-client-1')).toBeDefined()
    })

    it('should add multiple clients to the pool', async () => {
      const config1: MCPClientConfig = {
        name: 'client-a',
        command: 'node',
        args: ['server-a.js'],
        transport: 'stdio',
      }

      const config2: MCPClientConfig = {
        name: 'client-b',
        command: 'python',
        args: ['server-b.py'],
        transport: 'stdio',
      }

      await pool.addClient(config1)
      await pool.addClient(config2)

      expect(pool.listClients()).toEqual(
        expect.arrayContaining(['client-a', 'client-b'])
      )
    })
  })

  describe('removeClient', () => {
    it('should remove a client from the pool', async () => {
      const config: MCPClientConfig = {
        name: 'removable-client',
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      }

      await pool.addClient(config)
      expect(pool.getClient('removable-client')).toBeDefined()

      await pool.removeClient('removable-client')
      expect(pool.getClient('removable-client')).toBeUndefined()
    })

    it('should handle removing non-existent client gracefully', async () => {
      await expect(pool.removeClient('non-existent')).resolves.not.toThrow()
    })
  })

  describe('getClient', () => {
    it('should retrieve an existing client', async () => {
      const config: MCPClientConfig = {
        name: 'get-test-client',
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      }

      await pool.addClient(config)

      const client = pool.getClient('get-test-client')
      expect(client).toBeDefined()
      expect(client?.getName()).toBe('get-test-client')
    })

    it('should return undefined for non-existent client', () => {
      const client = pool.getClient('non-existent')
      expect(client).toBeUndefined()
    })
  })

  describe('listClients', () => {
    it('should list all connected clients', async () => {
      expect(pool.listClients()).toEqual([])

      const config1: MCPClientConfig = {
        name: 'list-test-1',
        command: 'node',
        args: ['server1.js'],
        transport: 'stdio',
      }

      const config2: MCPClientConfig = {
        name: 'list-test-2',
        command: 'python',
        args: ['server2.py'],
        transport: 'stdio',
      }

      await pool.addClient(config1)
      await pool.addClient(config2)

      const clients = pool.listClients()
      expect(clients).toContain('list-test-1')
      expect(clients).toContain('list-test-2')
    })
  })

  describe('listTools', () => {
    it('should list tools from a connected client', async () => {
      const config: MCPClientConfig = {
        name: 'tools-test-client',
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      }

      await pool.addClient(config)

      // Mock the tools list response
      const mockTools: RemoteTool[] = [
        {
          name: 'tool-a',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tool-b',
          description: 'Another test tool',
          inputSchema: { type: 'object', properties: {} },
        },
      ]

      // Override the client's listTools for this test
      const client = pool.getClient('tools-test-client')
      if (client) {
        client.listTools = vi.fn().mockResolvedValue(mockTools)
      }

      const tools = await pool.listTools('tools-test-client')
      expect(tools).toHaveLength(2)
      expect(tools[0].name).toBe('tool-a')
    })

    it('should throw error for non-existent client', async () => {
      await expect(pool.listTools('non-existent')).rejects.toThrow(
        'Client "non-existent" not found'
      )
    })
  })

  describe('callTool', () => {
    it('should call a tool on a connected client', async () => {
      const config: MCPClientConfig = {
        name: 'call-tool-client',
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      }

      await pool.addClient(config)

      // Mock the tool call response
      const mockResponse = {
        content: [{ type: 'text', text: 'Tool executed successfully' }],
      }

      const client = pool.getClient('call-tool-client')
      if (client) {
        client.callTool = vi.fn().mockResolvedValue(mockResponse)
      }

      const result = await pool.callTool('call-tool-client', 'test-tool', { arg: 'value' })
      expect(result.content[0].text).toBe('Tool executed successfully')
    })

    it('should throw error for non-existent client', async () => {
      await expect(
        pool.callTool('non-existent', 'some-tool', {})
      ).rejects.toThrow('Client "non-existent" not found')
    })
  })
})

describe('MCPClient', () => {
  describe('constructor', () => {
    it('should create a client with the given name', () => {
      const config: MCPClientConfig = {
        name: 'my-client',
        transport: 'stdio',
      }

      const client = new MCPClient(config)
      expect(client.getName()).toBe('my-client')
    })
  })

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      const client = new MCPClient({
        name: 'disconnected-client',
        transport: 'stdio',
      })

      expect(client.isConnected()).toBe(false)
    })
  })
})