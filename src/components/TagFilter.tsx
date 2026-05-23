import { useState, useEffect } from 'react'
import useTagManager from '../store/tagStore'
import useTaskStore from '../store/taskStore'

interface Props {
  activeTags: string[]
  onToggle: (tagId: string) => void
}

export default function TagFilter({ activeTags, onToggle }: Props) {
  const tags = useTagManager(s => s.tags)
  const tasks = useTaskStore(s => s.tasks)
  const initDefaults = useTagManager(s => s.initDefaults)

  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    initDefaults()
  }, [initDefaults])

  // Count tasks per tag
  const tagCounts: Record<string, number> = {}
  for (const tagId of tags.map(t => t.id)) {
    tagCounts[tagId] = tasks.filter(t => t.tags.includes(tagId)).length
  }

  const displayedTags = showAll ? tags : tags.slice(0, 5)

  return (
    <div className="tag-filter">
      <div className="tag-filter__header">
        <span>标签筛选</span>
        {tags.length > 5 && (
          <button onClick={() => setShowAll(!showAll)}>
            {showAll ? '收起' : `更多(${tags.length - 5})`}
          </button>
        )}
      </div>
      <div className="tag-filter__tags">
        {displayedTags.map(tag => {
          const color = useTagManager.getState().getColor(tag.id)
          const isActive = activeTags.includes(tag.id)
          return (
            <button
              key={tag.id}
              className={`tag-btn ${isActive ? 'tag-btn--active' : ''}`}
              style={{
                backgroundColor: isActive ? color.bg : 'transparent',
                color: isActive ? color.text : '#666',
                borderColor: color.border,
              }}
              onClick={() => onToggle(tag.id)}
            >
              {tag.name}
              {tagCounts[tag.id] > 0 && (
                <span className="tag-btn__count">{tagCounts[tag.id]}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}