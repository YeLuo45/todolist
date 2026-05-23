import { useState } from 'react'
import TaskInput from './components/TaskInput'
import TaskList from './components/TaskList'
import FilterBar from './components/FilterBar'
import TagFilter from './components/TagFilter'
import BatchActionBar from './components/BatchActionBar'
import './App.css'

function App() {
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchMode, setBatchMode] = useState(false)

  const toggleTag = (tagId: string) => {
    setActiveTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 todolist</h1>
        <p className="tagline">离线优先 · 事件总线 · nanobot风格</p>
        <button
          className={`batch-mode-btn ${batchMode ? 'batch-mode-btn--active' : ''}`}
          onClick={() => { setBatchMode(!batchMode); setSelectedIds([]); }}
        >
          {batchMode ? '退出批量' : '批量操作'}
        </button>
      </header>
      <main className="app-main">
        <FilterBar />
        <TagFilter activeTags={activeTags} onToggle={toggleTag} />
        <BatchActionBar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
        <TaskInput />
        <TaskList filterTags={activeTags} batchMode={batchMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
      </main>
    </div>
  )
}

export default App