import useTaskStore from '../store/taskStore'

export default function TaskList() {
  const tasks = useTaskStore(s => s.tasks)
  const completeTask = useTaskStore(s => s.completeTask)
  const deleteTask = useTaskStore(s => s.deleteTask)

  if (tasks.length === 0) {
    return <div className="task-list empty">暂无任务</div>
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
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
              <span className="task-item__due">
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <span className={`task-item__priority priority--${task.priority}`}>
            {task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '⚡' : '💤'}
          </span>
          <button onClick={() => deleteTask(task.id)}>删除</button>
        </div>
      ))}
    </div>
  )
}