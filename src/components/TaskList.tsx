import { useEffect, useState } from 'react'
import useTaskStore from '../store/taskStore'
import { smartSorter, type ScoredTask } from '../store/SmartSorter'
import TagBadgeList from './TagBadgeList'

interface Props {
  filterTags?: string[]
  batchMode?: boolean
  selectedIds?: string[]
  onToggleSelect?: (id: string) => void
}

export default function TaskList({ filterTags = [], batchMode = false, selectedIds = [], onToggleSelect }: Props) {
  const tasks = useTaskStore(s => s.tasks)
  const completeTask = useTaskStore(s => s.completeTask)
  const deleteTask = useTaskStore(s => s.deleteTask)
  const subscribe = useTaskStore(s => s.subscribe)
  const [scoredTasks, setScoredTasks] = useState<ScoredTask[]>([])

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setScoredTasks(smartSorter.processTasks(tasks))
    })
    setScoredTasks(smartSorter.processTasks(tasks))
    return unsubscribe
  }, [tasks, subscribe])

  const filteredTasks = filterTags.length > 0
    ? scoredTasks.filter(({ task }) =>
        filterTags.every(tagId => task.tags.includes(tagId))
      )
    : scoredTasks

  if (filteredTasks.length === 0) {
    return <div className="task-list empty">
      {filterTags.length > 0 ? '没有匹配标签的任务' : '暂无任务'}
    </div>
  }

  return (
    <div className="task-list">
      {filteredTasks.map(({ task, priorityScore, overdueDays }) => (
        <div key={task.id} className={`task-item task-item--${task.priority}`}>
          {batchMode && (
            <input
              type="checkbox"
              checked={selectedIds.includes(task.id)}
              onChange={() => onToggleSelect && onToggleSelect(task.id)}
            />
          )}
          <input
            type="checkbox"
            checked={task.status === 'completed'}
            onChange={() => completeTask(task.id)}
            disabled={task.status === 'completed'}
          />
          <div className="task-item__content">
            <span className={task.status === 'completed' ? 'completed' : ''}>
              {task.title}
            </span>
            <TagBadgeList task={task} />
            {task.dueDate && (
              <span className={`task-item__due ${overdueDays > 0 ? 'overdue' : ''}`}>
                {new Date(task.dueDate).toLocaleDateString()}
                {overdueDays > 0 && <em> ({Math.round(overdueDays)}天逾期)</em>}
              </span>
            )}
          </div>
          <span className={`task-item__priority priority--${task.priority}`}>
            {task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '⚡' : '💤'}
          </span>
          {smartSorter.isEnabled() && (
            <span className="task-item__score" title={`优先级分数: ${priorityScore.toFixed(1)}`}>
              {priorityScore > 0 ? `+${priorityScore.toFixed(0)}` : '0'}
            </span>
          )}
          {!batchMode && <button onClick={() => deleteTask(task.id)}>删除</button>}
        </div>
      ))}
    </div>
  )
}