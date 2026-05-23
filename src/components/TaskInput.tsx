import { useState, useEffect } from 'react'
import useTaskStore from '../store/taskStore'
import useTagManager from '../store/tagStore'
import type { TaskPriority, TaskStatus } from '../store/taskStore'

export default function TaskInput() {
  const addTask = useTaskStore(s => s.addTask)
  const tags = useTagManager(s => s.tags)
  const initDefaults = useTagManager(s => s.initDefaults)

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagSelector, setShowTagSelector] = useState(false)

  useEffect(() => {
    initDefaults()
  }, [initDefaults])

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addTask({
      title: title.trim(),
      description: '',
      status: 'pending' as TaskStatus,
      priority,
      dueDate: dueDate || undefined,
      tags: selectedTags,
    })
    setTitle('')
    setDueDate('')
    setSelectedTags([])
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

      <button
        type="button"
        className="task-input__tag-toggle"
        onClick={() => setShowTagSelector(!showTagSelector)}
        title="添加标签"
      >
        🏷️ {selectedTags.length > 0 ? `(${selectedTags.length})` : ''}
      </button>

      <button type="submit">添加</button>

      {showTagSelector && (
        <div className="task-input__tag-selector">
          {tags.map(tag => {
            const color = useTagManager.getState().getColor(tag.id)
            const isSelected = selectedTags.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                className={`tag-selector-btn ${isSelected ? 'tag-selector-btn--selected' : ''}`}
                style={{
                  backgroundColor: isSelected ? color.bg : 'transparent',
                  color: isSelected ? color.text : '#666',
                  borderColor: color.border,
                }}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
    </form>
  )
}