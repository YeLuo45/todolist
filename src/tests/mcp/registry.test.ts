import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, getRegistry, resetRegistry } from '../../mcp/registry';
import { MessageBus } from '../../db/messageBus';

describe('ToolRegistry', () => {
  let messageBus: MessageBus;
  let registry: ToolRegistry;

  beforeEach(() => {
    resetRegistry();
    messageBus = new MessageBus();
    registry = getRegistry(messageBus);
  });

  describe('register/unregister', () => {
    it('should register a tool', () => {
      registry.unregister('list-tasks');
      expect(registry.get('list-tasks')).toBeUndefined();
      registry.register({
        name: 'list-tasks',
        description: 'List tasks',
        inputSchema: { type: 'object' },
        requiredRole: 'reader'
      });
      expect(registry.get('list-tasks')).toBeDefined();
    });

    it('should unregister a tool', () => {
      const tool = registry.get('list-tasks');
      expect(tool).toBeDefined();
      registry.unregister('list-tasks');
      expect(registry.get('list-tasks')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all registered tools', () => {
      const tools = registry.list();
      expect(tools.length).toBeGreaterThanOrEqual(7);
      expect(tools.map(t => t.name).sort()).toEqual([
        'complete-task', 'create-task', 'delete-task', 'get-task',
        'list-tasks', 'query-by-tag', 'update-task'
      ].sort());
    });
  });

  describe('checkPermission', () => {
    it('reader cannot call admin-only tools', () => {
      expect(registry.checkPermission('delete-task', 'reader')).toBe(false);
      expect(registry.checkPermission('list-tasks', 'reader')).toBe(true);
    });

    it('operator can call reader and operator tools', () => {
      expect(registry.checkPermission('delete-task', 'operator')).toBe(false);
      expect(registry.checkPermission('create-task', 'operator')).toBe(true);
      expect(registry.checkPermission('list-tasks', 'operator')).toBe(true);
    });

    it('admin can call all tools', () => {
      expect(registry.checkPermission('delete-task', 'admin')).toBe(true);
      expect(registry.checkPermission('create-task', 'admin')).toBe(true);
      expect(registry.checkPermission('list-tasks', 'admin')).toBe(true);
    });
  });

  describe('filterByRole', () => {
    it('should filter tools by role', () => {
      const adminTools = registry.filterByRole('admin');
      const readerTools = registry.filterByRole('reader');
      expect(adminTools.length).toBeGreaterThan(readerTools.length);
      expect(adminTools.length).toBe(7);
      expect(readerTools.length).toBeLessThan(7);
    });
  });

  describe('initialization', () => {
    it('should auto-register all 7 MCP tools', () => {
      const tools = registry.list();
      expect(tools.length).toBe(7);
    });

    it('should have correct roles for all tools', () => {
      expect(registry.get('delete-task')?.requiredRole).toBe('admin');
      expect(registry.get('create-task')?.requiredRole).toBe('operator');
      expect(registry.get('list-tasks')?.requiredRole).toBe('reader');
    });
  });
});