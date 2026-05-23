import { useEffect, useState } from 'react'
import useTaskStore from '../store/taskStore'
import { smartSorter, type ScoredTask } from '../store/SmartSorter'

export default function TaskList() {
  const tasks = useTaskStore(s => s.tasks)
  const completeTask = useTaskStore(s => s.completeTask)
  const deleteTask = useTaskStore(s => s.deleteTask)
  const subscribe = useTaskStore(s => s.subscribe)
  const [scoredTasks, setScoredTasks] = useState<ScoredTask[]>([])

  // Subscribe to TaskBus events to re-sort when tasks change
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setScoredTasks(smartSorter.processTasks(tasks))
    })
    // Initial sort
    setScoredTasks(smartSorter.processTasks(tasks))
    return unsubscribe
  }, [tasks, subscribe])

  if (tasks.length === 0) {
    return <div className="task-list empty">暂无任务</div>
  }

  return (
    <div className="task-list">
      {scoredTasks.map(({ task, priorityScore, overdueDays }) => (
        <div key={task.id} className={`task-item task-item--${task.priority}`}>
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
          <button onClick={() => deleteTask(task.id)}>删除</button>
        </div>
      ))}
    </div>
  )
}