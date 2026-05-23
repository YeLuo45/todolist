import { useState } from 'react'
import useTaskStore from '../store/taskStore'
import type { TaskPriority, TaskStatus } from '../store/taskStore'

export default function TaskInput() {
  const addTask = useTaskStore(s => s.addTask)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addTask({
      title: title.trim(),
      description: '',
      status: 'pending' as TaskStatus,
      priority,
      dueDate: dueDate || undefined,
      tags: [],
    })
    setTitle('')
    setDueDate('')
  }

  return (
    <form onSubmit={handleSubmit} className="task-input">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="添加新任务..."
        className="task-input__text"
      />
      <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
        <option value="low">低</option>
        <option value="medium">中</option>
        <option value="high">高</option>
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        className="task-input__date"
      />
      <button type="submit">添加</button>
    </form>
  )
}