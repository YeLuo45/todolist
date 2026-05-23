/**
 * PresetScenes - Quick weight presets for SmartSorter
 * Inspired by generic-agent-design ContextWindow pattern
 */

import type { PriorityWeights } from './SmartSorter'

export interface PresetScene {
  id: string
  label: string
  icon: string
  description: string
  weights: PriorityWeights
}

export const PRESET_SCENES: PresetScene[] = [
  {
    id: 'urgent',
    label: '紧急优先',
    icon: '🚨',
    description: '逾期任务优先，忽略创建时间',
    weights: { overdueDays: 20, priority: 5, createdHours: 0 },
  },
  {
    id: 'today',
    label: '今日待办',
    icon: '📅',
    description: '今天截止的任务优先，高优先级加权',
    weights: { overdueDays: 5, priority: 10, createdHours: 0.5 },
  },
  {
    id: 'weekly',
    label: '本周规划',
    icon: '📆',
    description: '平衡逾期和优先级，预设本周任务',
    weights: { overdueDays: 3, priority: 5, createdHours: 1 },
  },
]

export function applyPreset(sceneId: string, current: PriorityWeights): PriorityWeights {
  const scene = PRESET_SCENES.find(s => s.id === sceneId)
  return scene ? { ...scene.weights } : current
}