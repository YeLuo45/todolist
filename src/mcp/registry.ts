import { MessageBus } from '../db/messageBus';

export type Role = 'admin' | 'operator' | 'reader';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredRole: Role;
}

export class ToolRegistry {
  private tools: Map<string, ToolDescriptor> = new Map();
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
  }

  register(tool: ToolDescriptor): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  list(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }

  checkPermission(toolName: string, role: Role): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;
    const roleOrder: Record<Role, number> = { reader: 0, operator: 1, admin: 2 };
    return roleOrder[role] >= roleOrder[tool.requiredRole];
  }

  filterByRole(role: Role): ToolDescriptor[] {
    return this.list().filter(t => this.checkPermission(t.name, role));
  }
}

// Singleton instance
let _registry: ToolRegistry | null = null;

export function getRegistry(messageBus: MessageBus): ToolRegistry {
  if (!_registry) {
    _registry = new ToolRegistry(messageBus);
    _registry.register({
      name: 'list-tasks',
      description: '列出任务，支持分页和状态过滤',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'completed'] },
          page: { type: 'number', default: 1 },
          pageSize: { type: 'number', default: 20 }
        }
      },
      requiredRole: 'reader'
    });
    _registry.register({
      name: 'create-task',
      description: '创建新任务',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'number', enum: [1, 2, 3] },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['title']
      },
      requiredRole: 'operator'
    });
    _registry.register({
      name: 'update-task',
      description: '更新任务内容',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'number', enum: [1, 2, 3] },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['id']
      },
      requiredRole: 'operator'
    });
    _registry.register({
      name: 'delete-task',
      description: '删除任务',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      requiredRole: 'admin'
    });
    _registry.register({
      name: 'complete-task',
      description: '标记任务为已完成',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      requiredRole: 'operator'
    });
    _registry.register({
      name: 'query-by-tag',
      description: '按标签查询任务',
      inputSchema: {
        type: 'object',
        properties: {
          tag: { type: 'string' }
        },
        required: ['tag']
      },
      requiredRole: 'reader'
    });
    _registry.register({
      name: 'get-task',
      description: '获取单个任务详情',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      requiredRole: 'reader'
    });
  }
  return _registry;
}

export function resetRegistry(): void {
  _registry = null;
}