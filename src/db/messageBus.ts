/**
 * MessageBus - Async message queue for nanobot-style event handling
 */

export interface InboundMessage {
  type: string
  payload: Record<string, unknown>
  ts: string
}

export interface Channel {
  name: string
  subscribe(handler: (msg: InboundMessage) => void): () => void
  publish(msg: InboundMessage): void
}

type MessageHandler = (msg: InboundMessage) => void

/**
 * MessageBus - Pub/sub message queue that decouples senders from receivers
 */
export class MessageBus {
  private channels: Map<string, Set<MessageHandler>> = new Map()
  private defaultChannel: Set<MessageHandler> = new Set()
  private messageQueue: InboundMessage[] = []
  private isProcessing = false

  /**
   * Publish a message to the default channel (or a named channel)
   */
  async publish(msg: InboundMessage): Promise<void> {
    this.messageQueue.push(msg)
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Publish to a specific channel
   */
  publishToChannel(channelName: string, msg: InboundMessage): void {
    const channel = this.channels.get(channelName)
    if (channel) {
      channel.forEach(handler => {
        try {
          handler(msg)
        } catch (e) {
          console.error(`MessageBus handler error:`, e)
        }
      })
    }
  }

  /**
   * Subscribe to the default channel
   */
  subscribe(handler: MessageHandler): () => void {
    this.defaultChannel.add(handler)
    return () => {
      this.defaultChannel.delete(handler)
    }
  }

  /** Reset internal state (for testing only) */
  reset(): void {
    this.defaultChannel.clear()
    this.messageQueue = []
    this.isProcessing = false
  }

  /**
   * Flush the message queue — wait for all pending messages to be processed.
   * For testing only.
   */
  async flush(): Promise<void> {
    // Wait for queue to drain
    while (this.messageQueue.length > 0 || this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  /**
   * Create or get a named channel
   */
  createChannel(name: string): Channel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new Set<MessageHandler>())
    }
    const channelHandlers = this.channels.get(name)!

    return {
      name,
      subscribe: (handler: MessageHandler) => {
        channelHandlers.add(handler)
        return () => {
          channelHandlers.delete(handler)
        }
      },
      publish: (msg: InboundMessage) => {
        this.publishToChannel(name, msg)
      },
    }
  }

  /**
   * Process queued messages asynchronously
   */
  private processQueue(): void {
    this.isProcessing = true
    const processNext = () => {
      if (this.messageQueue.length === 0) {
        this.isProcessing = false
        return
      }
      const msg = this.messageQueue.shift()!
      this.defaultChannel.forEach(handler => {
        try {
          handler(msg)
        } catch (e) {
          console.error(`MessageBus handler error:`, e)
        }
      })
      // Use setTimeout(0) to process asynchronously without blocking
      setTimeout(processNext, 0)
    }
    setTimeout(processNext, 0)
  }
}

// Singleton instance
export const messageBus = new MessageBus()

// Message type constants
export const MessageTypes = {
  TASK_ADDED: 'TASK_ADDED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_DELETED: 'TASK_DELETED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TAG_CREATED: 'TAG_CREATED',
  TAG_UPDATED: 'TAG_UPDATED',
  TAG_DELETED: 'TAG_DELETED',
}

/**
 * Factory: create a task-related message
 */
export function createTaskMessage(type: string, taskId: string, extra: Record<string, unknown> = {}): InboundMessage {
  return {
    type,
    payload: { taskId, ...extra },
    ts: new Date().toISOString(),
  }
}

/**
 * Factory: create a tag-related message
 */
export function createTagMessage(type: string, tagId: string, extra: Record<string, unknown> = {}): InboundMessage {
  return {
    type,
    payload: { tagId, ...extra },
    ts: new Date().toISOString(),
  }
}
