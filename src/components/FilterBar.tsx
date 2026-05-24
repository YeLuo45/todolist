import { useState } from 'react'
import { smartSorter } from '../store/SmartSorter'
import WeightConfigPanel from './WeightConfigPanel'

export default function FilterBar() {
  const [enabled, setEnabled] = useState(false)
  const [showWeights, setShowWeights] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const weights = smartSorter.getWeights()

  const toggleSmartSort = () => {
    if (enabled) {
      smartSorter.disable()
    } else {
      smartSorter.enable()
    }
    setEnabled(!enabled)
  }

  return (
    <>
      <div className="filter-bar">
        <label className="filter-bar__smart-sort">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleSmartSort}
          />
          <span>🧠 智能排序</span>
        </label>

        {enabled && (
          <button
            className="filter-bar__toggle-weights"
            onClick={() => setShowWeights(!showWeights)}
          >
            {showWeights ? '隐藏' : '权重'}
          </button>
        )}

        {enabled && (
          <button
            className="filter-bar__config-btn"
            onClick={() => setShowConfig(true)}
          >
            ⚙️
          </button>
        )}

        {enabled && showWeights && (
          <div className="filter-bar__weights">
            <span>逾期: ×{weights.overdueDays}</span>
            <span>优先级: ×{weights.priority}</span>
            <span>创建时间: ×{weights.createdHours}</span>
          </div>
        )}
      </div>

      {showConfig && <WeightConfigPanel onClose={() => setShowConfig(false)} />}
    </>
  )
}