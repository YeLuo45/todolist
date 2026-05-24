import useTaskStore from '../store/taskStore'

interface Props {
  selectedIds: string[]
  onClear: () => void
}

export default function BatchActionBar({ selectedIds, onClear }: Props) {
  const batchComplete = useTaskStore(s => s.batchComplete)
  const batchDelete = useTaskStore(s => s.batchDelete)

  if (selectedIds.length === 0) return null

  const handleComplete = () => {
    batchComplete(selectedIds)
    onClear()
  }

  const handleDelete = () => {
    batchDelete(selectedIds)
    onClear()
  }

  return (
    <div className="batch-action-bar">
      <span className="batch-action-bar__count">已选择 {selectedIds.length} 项</span>
      <button onClick={handleComplete}>✓ 批量完成</button>
      <button onClick={handleDelete} className="batch-action-bar__delete">🗑 删除</button>
      <button onClick={onClear}>取消</button>
    </div>
  )
}