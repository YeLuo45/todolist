import { useState } from 'react'
import TaskInput from './components/TaskInput'
import TaskList from './components/TaskList'
import FilterBar from './components/FilterBar'
import TagFilter from './components/TagFilter'
import './App.css'

function App() {
  const [activeTags, setActiveTags] = useState<string[]>([])

  const toggleTag = (tagId: string) => {
    setActiveTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 todolist</h1>
        <p className="tagline">离线优先 · 事件总线 · nanobot风格</p>
      </header>
      <main className="app-main">
        <FilterBar />
        <TagFilter activeTags={activeTags} onToggle={toggleTag} />
        <TaskInput />
        <TaskList filterTags={activeTags} />
      </main>
    </div>
  )
}

export default App