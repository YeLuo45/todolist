import { describe, it, expect, beforeEach } from 'vitest'
import useTagManager, { TAG_COLORS, DEFAULT_TAGS } from '../store/tagStore'

describe('useTagManager', () => {
  beforeEach(() => {
    // Reset tags to empty before each test
    useTagManager.setState({ tags: [] })
  })

  describe('initDefaults', () => {
    it('does nothing if tags already exist', () => {
      useTagManager.setState({ tags: [{ id: 'existing', name: 'Test', colorIndex: 0 }] })
      useTagManager.getState().initDefaults()
      expect(useTagManager.getState().tags).toHaveLength(1)
    })

    it('adds default tags if empty', () => {
      useTagManager.getState().initDefaults()
      expect(useTagManager.getState().tags).toEqual(DEFAULT_TAGS)
    })
  })

  describe('addTag', () => {
    it('adds a tag with default color', () => {
      const id = useTagManager.getState().addTag('work')
      const tag = useTagManager.getState().getTag(id)
      expect(tag).toBeTruthy()
      expect(tag!.name).toBe('work')
      expect(tag!.colorIndex).toBe(0)
    })

    it('adds a tag with custom color', () => {
      const id = useTagManager.getState().addTag('urgent', 2)
      const tag = useTagManager.getState().getTag(id)
      expect(tag!.colorIndex).toBe(2)
    })

    it('returns a unique id', () => {
      const id1 = useTagManager.getState().addTag('a')
      const id2 = useTagManager.getState().addTag('b')
      expect(id1).not.toBe(id2)
    })
  })

  describe('removeTag', () => {
    it('removes existing tag', () => {
      const id = useTagManager.getState().addTag('temp')
      useTagManager.getState().removeTag(id)
      expect(useTagManager.getState().getTag(id)).toBeUndefined()
    })
  })

  describe('updateTag', () => {
    it('updates tag name and color', () => {
      const id = useTagManager.getState().addTag('old')
      useTagManager.getState().updateTag(id, 'new', 3)
      const tag = useTagManager.getState().getTag(id)
      expect(tag!.name).toBe('new')
      expect(tag!.colorIndex).toBe(3)
    })
  })

  describe('getColor', () => {
    it('returns color for known tag', () => {
      useTagManager.setState({ tags: [{ id: 't1', name: 'Test', colorIndex: 2 }] })
      const color = useTagManager.getState().getColor('t1')
      expect(color).toEqual(TAG_COLORS[2])
    })

    it('returns first color for unknown tag', () => {
      const color = useTagManager.getState().getColor('unknown')
      expect(color).toEqual(TAG_COLORS[0])
    })
  })

  describe('getTag', () => {
    it('returns undefined for unknown id', () => {
      expect(useTagManager.getState().getTag('nonexistent')).toBeUndefined()
    })

    it('returns tag for known id', () => {
      const id = useTagManager.getState().addTag('findme')
      expect(useTagManager.getState().getTag(id)!.name).toBe('findme')
    })
  })
})
