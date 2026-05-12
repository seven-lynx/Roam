import { describe, it, expect } from 'vitest'

// Message type constants are string literals — test that the union is stable
// and matches what the background handler expects. Importing the types as
// values via a discriminated union narrowing check prevents silent renames.
import type { Request, Response } from '../lib/messages'

describe('Message protocol types', () => {
  it('Request.ROAM is assignable with no required fields', () => {
    const msg: Request = { type: 'ROAM' }
    expect(msg.type).toBe('ROAM')
  })

  it('Request.RATE requires url_id and vote 1 or -1', () => {
    const up: Request   = { type: 'RATE', url_id: 'abc', vote: 1 }
    const down: Request = { type: 'RATE', url_id: 'abc', vote: -1 }
    expect(up.type).toBe('RATE')
    expect(down.type).toBe('RATE')
  })

  it('Request.SUBMIT_URL requires url and categoryId', () => {
    const msg: Request = { type: 'SUBMIT_URL', url: 'https://example.com', categoryId: 'cat-1' }
    expect(msg.type).toBe('SUBMIT_URL')
  })

  it('Response ok:true carries data', () => {
    const res: Response<string> = { ok: true, data: 'hello' }
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data).toBe('hello')
  })

  it('Response ok:false carries error string', () => {
    const res: Response<never> = { ok: false, error: 'Something went wrong' }
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBeTruthy()
  })

  it('Request.SET_LANGUAGE_PREF carries a languages array', () => {
    const msg: Request = { type: 'SET_LANGUAGE_PREF', languages: ['en', 'fr'] }
    expect(msg.type).toBe('SET_LANGUAGE_PREF')
    if (msg.type === 'SET_LANGUAGE_PREF') {
      expect(msg.languages).toEqual(['en', 'fr'])
    }
  })
})
