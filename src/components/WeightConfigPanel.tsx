import { useState } from 'react'
import { smartSorter } from '../store/SmartSorter'
import { PRESET_SCENES, applyPreset } from '../store/PresetScenes'
import type { PriorityWeights } from '../store/SmartSorter'

interface Props {
  onClose: () => void
}

export default function WeightConfigPanel({ onClose }: Props) {
  const [weights, setWeights] = useState<PriorityWeights>(smartSorter.getWeights())
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const updateWeight = (key: keyof PriorityWeights, value: number) => {
    const updated = { ...weights, [key]: value }
    setWeights(updated)
    smartSorter.setWeights(updated)
    setActivePreset(null)
  }

  const applyScene = (sceneId: string) => {
    const newWeights = applyPreset(sceneId, weights)
    setWeights(newWeights)
    smartSorter.setWeights(newWeights)
    setActivePreset(sceneId)
  }

  return (
    <div className="weight-config-panel">
      <div className="weight-config-panel__header">
        <h3>⚙️ 权重配置</h3>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="weight-config-panel__presets">
        <p className="weight-config-panel__section-title">预设场景</p>
        <div className="weight-config-panel__preset-grid">
          {PRESET_SCENES.map(scene => (
            <button
              key={scene.id}
              className={`preset-btn ${activePreset === scene.id ? 'preset-btn--active' : ''}`}
              onClick={() => applyScene(scene.id)}
              title={scene.description}
            >
              <span className="preset-btn__icon">{scene.icon}</span>
              <span className="preset-btn__label">{scene.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="weight-config-panel__sliders">
        <p className="weight-config-panel__section-title">自定义权重</p>

        <label className="weight-slider">
          <span className="weight-slider__label">逾期天数权重 (overdueDays)</span>
          <span className="weight-slider__value">{weights.overdueDays}</span>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={weights.overdueDays}
            onChange={e => updateWeight('overdueDays', Number(e.target.value))}
          />
        </label>

        <label className="weight-slider">
          <span className="weight-slider__label">优先级权重 (priority)</span>
          <span className="weight-slider__value">{weights.priority}</span>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={weights.priority}
            onChange={e => updateWeight('priority', Number(e.target.value))}
          />
        </label>

        <label className="weight-slider">
          <span className="weight-slider__label">创建时间权重 (createdHours)</span>
          <span className="weight-slider__value">{weights.createdHours}</span>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={weights.createdHours}
            onChange={e => updateWeight('createdHours', Number(parseFloat(e.target.value).toFixed(1)))}
          />
        </label>
      </div>

      <div className="weight-config-panel__preview">
        <span>当前公式:</span>
        <code>
          score = {weights.overdueDays}×overdue + {weights.priority}×priority + {weights.createdHours}×hours
        </code>
      </div>
    </div>
  )
}