import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TaskStatus = 'pending' | 'completed' | 'overdue'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  createdAt: string
  completedAt?: string
  tags: string[]
}

interface TaskState {
  tasks: Task[]
  // EventBus-style publishing
  publish: (event: TaskEvent) => void
  // Subscribers
  subscribers: ((event: TaskEvent) => void)[]
  subscribe: (fn: (event: TaskEvent) => void) => () => void
  // Task operations
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => string
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  completeTask: (id: string) => void
  // Batch operations
  batchComplete: (ids: string[]) => void
  batchDelete: (ids: string[]) => void
}

export type TaskEvent =
  | { type: 'TASK_ADDED'; taskId: string; task: Task }
  | { type: 'TASK_UPDATED'; taskId: string; task: Task }
  | { type: 'TASK_DELETED'; taskId: string }
  | { type: 'TASK_COMPLETED'; taskId: string; task: Task }
  | { type: 'TASK_OVERDUE'; taskId: string }

let taskIdCounter = Date.now()

const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      subscribers: [],

      publish: (event) => {
        get().subscribers.forEach(fn => fn(event))
      },

      subscribe: (fn) => {
        set(state => ({ subscribers: [...state.subscribers, fn] }))
        return () => {
          set(state => ({ subscribers: state.subscribers.filter(s => s !== fn) }))
        }
      },

      addTask: (taskData) => {
        const id = `task-${taskIdCounter++}-${Date.now()}`
        const task: Task = {
          ...taskData,
          id,
          createdAt: new Date().toISOString(),
        }
        set(state => ({ tasks: [...state.tasks, task] }))
        get().publish({ type: 'TASK_ADDED', taskId: id, task })
        return id
      },

      updateTask: (id, updates) => {
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }))
        const task = get().tasks.find(t => t.id === id)
        if (task) get().publish({ type: 'TASK_UPDATED', taskId: id, task })
      },

      deleteTask: (id) => {
        set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }))
        get().publish({ type: 'TASK_DELETED', taskId: id })
      },

      completeTask: (id) => {
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === id
              ? { ...t, status: 'completed' as TaskStatus, completedAt: new Date().toISOString() }
              : t
          ),
        }))
        const task = get().tasks.find(t => t.id === id)
        if (task) get().publish({ type: 'TASK_COMPLETED', taskId: id, task })
      },

      batchComplete: (ids) => {
        const now = new Date().toISOString()
        set(state => ({
          tasks: state.tasks.map(t =>
            ids.includes(t.id)
              ? { ...t, status: 'completed' as TaskStatus, completedAt: now }
              : t
          ),
        }))
        ids.forEach(id => {
          const task = get().tasks.find(t => t.id === id)
          if (task) get().publish({ type: 'TASK_COMPLETED', taskId: id, task })
        })
      },

      batchDelete: (ids) => {
        set(state => ({ tasks: state.tasks.filter(t => !ids.includes(t.id)) }))
        ids.forEach(id => get().publish({ type: 'TASK_DELETED', taskId: id }))
      },
    }),
    {
      name: 'todolist-tasks',
    }
  )
)

export default useTaskStore