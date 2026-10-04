import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { useGearLibraryStore } from '../gear-library'

vi.mock(import('#imports'), () => {
  return { clearNuxtData: vi.fn<() => void>() }
})

describe('gear library edit invalidation', () => {
  it.each([{
    action: 'markItemSaved',
    isSaved: true
  }, {
    action: 'markItemRemoved',
    isSaved: false
  }] as const)('keeps membership override $isSaved after editing the item', ({ action, isSaved }) => {
    const pinia = createPinia()

    setActivePinia(pinia)

    onTestFinished(() => {
      disposePinia(pinia)
      setActivePinia(undefined)
    })

    const store = useGearLibraryStore()
    const itemId = 'edited-item'

    store[action](itemId)
    store.markItemEdited(itemId)

    const isInMyGear = store.resolveIsInMyGear({
      id: itemId,
      isInMyGear: !isSaved
    })

    expect(isInMyGear).toBe(isSaved)
  })
})
