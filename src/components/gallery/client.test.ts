import { expect, it } from 'vitest'
import { uploadFailure } from './client'

it('distinguishes a temporary upload rate limit from an oversized image and exhausted attempts', async () => {
  const failure = (error: string, status = 429) => uploadFailure(Response.json({ error }, { status }))
  const rate = await failure('rate_limited')
  expect(rate.retryable).toBe(true)
  expect(rate.message).toContain('Wait a minute')
  const exhausted = await failure('upload_attempts_exhausted')
  expect(exhausted.retryable).toBe(false)
  expect(exhausted.message).toContain('Start a new submission')
  const size = await failure('limit_exceeded', 400)
  expect(size.retryable).toBe(false)
  expect(size.message).toContain('size limit')
})
