import useTagManager from '../store/tagStore'
import type { Task } from '../store/taskStore'

interface Props {
  task: Task
}

export default function TagBadgeList({ task }: Props) {
  if (task.tags.length === 0) return null

  return (
    <div className="tag-badge-list">
      {task.tags.map(tagId => {
        const color = useTagManager.getState().getColor(tagId)
        const tag = useTagManager.getState().getTag(tagId)
        if (!tag) return null
        return (
          <span
            key={tagId}
            className="tag-badge"
            style={{
              backgroundColor: color.bg,
              color: color.text,
              borderColor: color.border,
            }}
          >
            {tag.name}
          </span>
        )
      })}
    </div>
  )
}