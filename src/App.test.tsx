// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
vi.mock('./services/dictionary', () => ({ lookupTerm: vi.fn().mockResolvedValue({ word: 'breathe', phonetic: '/briːð/', meanings: [{ partOfSpeech: 'verb', definitions: ['To take air into the lungs.'] }] }) }))
const host = document.createElement('div')
document.body.append(host)
let root: ReturnType<typeof createRoot> | undefined
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; localStorage.clear() })
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === label)
  expect(button).toBeDefined()
  await act(async () => { button!.click() })
}
describe('查词交互', () => {
  it('支持继续查看与读音反馈，只有明确确认后才学习', async () => {
    await act(async () => { root = createRoot(host); root.render(<App />) })
    const query = host.querySelector<HTMLInputElement>('#query')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(query, 'breeth')
      query.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(host.querySelectorAll('.candidate')).toHaveLength(8)
    expect(host.querySelector('.candidate h3')!.textContent).toContain('breathe')
    await click('继续检索其他候选')
    expect(host.querySelectorAll('.candidate').length).toBeGreaterThan(8)
    await click('都不是，核对读音和语境')
    expect(host.querySelector('#corrected-ipa')).not.toBeNull()
    await click('元音不对')
    const before = host.querySelector('.ipa')!.textContent
    await act(async () => { host.querySelector('.feedback form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(host.querySelector('.ipa')!.textContent).not.toBe(before)
    // 重新检索原始拼写，验证查看与确认是两个独立动作。
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { host.querySelector<HTMLButtonElement>('.candidate button')!.click() })
    expect(localStorage.getItem('fuzzy-word-finder-history')).toBeNull()
    await click('确认就是这个词，记录这次拼写')
    expect(JSON.parse(localStorage.getItem('fuzzy-word-finder-history')!)).toHaveLength(1)
    expect(host.querySelector('.domain-bars')!.textContent).toContain('健康')
    await click('清除记录与学习档案')
    expect(localStorage.getItem('fuzzy-word-finder-history')).toBeNull()
    expect(host.querySelector('.domain-bars')).toBeNull()
  })
})
