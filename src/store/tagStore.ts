/**
 * TagManager - Tag CRUD, colors, presets
 * Inspired by thunderbolt-design MultiAgent pattern for state separation
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TagColor {
  bg: string
  text: string
  border: string
}

export const TAG_COLORS: TagColor[] = [
  { bg: '#FFE4E4', text: '#C0392B', border: '#E74C3C' },
  { bg: '#FFF4E4', text: '#D35400', border: '#E67E22' },
  { bg: '#FFF9E4', text: '#B7950B', border: '#F1C40F' },
  { bg: '#E8F5E9', text: '#27AE60', border: '#2ECC71' },
  { bg: '#E3F2FD', text: '#2980B9', border: '#3498DB' },
  { bg: '#EDE7F6', text: '#8E24AA', border: '#9B59B6' },
  { bg: '#FCE4EC', text: '#C2185B', border: '#E91E63' },
  { bg: '#ECEFF1', text: '#546E7A', border: '#78909C' },
]

export interface TagPreset {
  id: string
  name: string
  colorIndex: number
}

export const DEFAULT_TAGS: TagPreset[] = [
  { id: 'work', name: '工作', colorIndex: 4 },
  { id: 'personal', name: '个人', colorIndex: 6 },
  { id: 'urgent', name: '紧急', colorIndex: 0 },
  { id: 'ideas', name: '想法', colorIndex: 2 },
]

export interface TagManagerState {
  tags: TagPreset[]
  // Tag operations
  addTag: (name: string, colorIndex?: number) => string
  removeTag: (id: string) => void
  updateTag: (id: string, name: string, colorIndex: number) => void
  getTag: (id: string) => TagPreset | undefined
  getColor: (id: string) => TagColor
  // Init with defaults
  initDefaults: () => void
}

const useTagManager = create<TagManagerState>()(
  persist(
    (set, get) => ({
      tags: [],

      initDefaults: () => {
        const existing = get().tags
        if (existing.length === 0) {
          set({ tags: DEFAULT_TAGS })
        }
      },

      addTag: (name, colorIndex = 0) => {
        const id = `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        set(state => ({
          tags: [...state.tags, { id, name, colorIndex }]
        }))
        return id
      },

      removeTag: (id) => {
        set(state => ({
          tags: state.tags.filter(t => t.id !== id)
        }))
      },

      updateTag: (id, name, colorIndex) => {
        set(state => ({
          tags: state.tags.map(t =>
            t.id === id ? { ...t, name, colorIndex } : t
          )
        }))
      },

      getTag: (id) => {
        return get().tags.find(t => t.id === id)
      },

      getColor: (id) => {
        const tag = get().tags.find(t => t.id === id)
        const idx = tag ? tag.colorIndex : 0
        return TAG_COLORS[idx % TAG_COLORS.length]
      },
    }),
    {
      name: 'todolist-tags',
    }
  )
)

export default useTagManager