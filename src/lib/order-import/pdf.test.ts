import { afterEach, expect, it, vi } from 'vitest'
import { readOrderPdf } from './index'

const getDocument = vi.hoisted(() => vi.fn())
vi.mock('pdfjs-dist', () => ({ getDocument, GlobalWorkerOptions: {} }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf-worker.js' }))
const file = { size: 5, arrayBuffer: async () => new ArrayBuffer(5) } as File
function pending<T>() {
  let reject!: (error: Error) => void
  const promise = new Promise<T>((_, fail) => { reject = fail })
  return { promise, reject }
}
afterEach(() => vi.clearAllMocks())

it.each(['loading', 'page', 'text', 'destroy'])('aborts a hung PDF %s operation and destroys the loading task once', async stage => {
  const stuck = pending<never>()
  const teardown = pending<void>()
  const getTextContent = vi.fn().mockImplementation(() => stage === 'text' ? stuck.promise : Promise.resolve({ items: [{ str: 'Order', transform: [1, 0, 0, 1, 0, 10] }] }))
  const getPage = vi.fn().mockImplementation(() => stage === 'page' ? stuck.promise : Promise.resolve({ getTextContent }))
  const destroy = vi.fn().mockReturnValue(teardown.promise)
  getDocument.mockReturnValue({ promise: stage === 'loading' ? stuck.promise : Promise.resolve({ numPages: 1, getPage }), destroy })
  const controller = new AbortController()
  const result = readOrderPdf(file, controller.signal)
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(stage === 'loading' ? getDocument : stage === 'page' ? getPage : stage === 'text' ? getTextContent : destroy).toHaveBeenCalledTimes(1))
  controller.abort()
  await assertion
  expect(destroy).toHaveBeenCalledTimes(1)
  // Rejections after the caller has settled must still have observers. Vitest
  // reports unhandled rejections as failures even when assertions pass.
  if (stage !== 'destroy') stuck.reject(new Error('Late PDF failure'))
  teardown.reject(new Error('Late teardown failure'))
  await new Promise(resolve => setTimeout(resolve, 0))
})

it('does not start work when already cancelled', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(readOrderPdf(file, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(getDocument).not.toHaveBeenCalled()
})

it('returns text and destroys the task on successful completion', async () => {
  const destroy = vi.fn().mockResolvedValue(undefined)
  getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'Order', transform: [1, 0, 0, 1, 0, 10] }] }) }) }), destroy })
  expect(await readOrderPdf(file)).toBe('Order\n')
  expect(destroy).toHaveBeenCalledTimes(1)
})
