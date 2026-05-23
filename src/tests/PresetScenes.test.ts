import { describe, it, expect } from 'vitest'
import { PRESET_SCENES, applyPreset } from '../store/PresetScenes'

describe('PresetScenes', () => {
  describe('PRESET_SCENES', () => {
    it('contains 3 presets', () => {
      expect(PRESET_SCENES).toHaveLength(3)
    })

    it('each preset has required fields', () => {
      for (const scene of PRESET_SCENES) {
        expect(scene.id).toBeTruthy()
        expect(scene.label).toBeTruthy()
        expect(scene.icon).toBeTruthy()
        expect(scene.description).toBeTruthy()
        expect(scene.weights).toBeTruthy()
        expect(typeof scene.weights.overdueDays).toBe('number')
        expect(typeof scene.weights.priority).toBe('number')
        expect(typeof scene.weights.createdHours).toBe('number')
      }
    })

    it('urgent preset has highest overdueDays weight', () => {
      const urgent = PRESET_SCENES.find(s => s.id === 'urgent')
      expect(urgent!.weights.overdueDays).toBeGreaterThan(10)
    })

    it('today preset has highest priority weight', () => {
      const today = PRESET_SCENES.find(s => s.id === 'today')
      expect(today!.weights.priority).toBeGreaterThan(5)
    })
  })

  describe('applyPreset', () => {
    it('returns weights for known preset', () => {
      const result = applyPreset('urgent', { overdueDays: 1, priority: 1, createdHours: 0 })
      expect(result.overdueDays).toBe(20)
    })

    it('returns current weights for unknown preset', () => {
      const current = { overdueDays: 5, priority: 5, createdHours: 1 }
      const result = applyPreset('unknown-preset', current)
      expect(result).toEqual(current)
    })
  })
})
