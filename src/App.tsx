import TaskInput from './components/TaskInput'
import TaskList from './components/TaskList'
import FilterBar from './components/FilterBar'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 todolist</h1>
        <p className="tagline">离线优先 · 事件总线 · nanobot风格</p>
      </header>
      <main className="app-main">
        <FilterBar />
        <TaskInput />
        <TaskList />
      </main>
    </div>
  )
}

export default App