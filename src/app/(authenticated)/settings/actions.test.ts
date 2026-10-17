import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const maybeSingle = vi.fn()
const updateEq = vi.fn()
const update = vi.fn(() => ({ eq: updateEq }))
const rpc = vi.fn()
const upload = vi.fn()
const remove = vi.fn()
const calls: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      update: (...args: unknown[]) => {
        calls.push('update')
        return update(...(args as []))
      },
    }),
    rpc: (...args: unknown[]) => {
      calls.push('rpc')
      return rpc(...args)
    },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => {
          calls.push('upload')
          return upload(...args)
        },
        remove: (...args: unknown[]) => {
          calls.push('remove')
          return remove(...args)
        },
      }),
    },
  }),
}))

const { saveProfileSettings } = await import('./actions')

const USER = 'user-1'
const idle = { status: 'idle' as const }

function form(fields: Record<string, string | Blob>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const jpeg = (size = 2000) => {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff])
  return new Blob([bytes], { type: 'image/jpeg' })
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  getUser.mockResolvedValue({ data: { user: { id: USER } } })
  maybeSingle.mockResolvedValue({ data: { avatar_path: null }, error: null })
  rpc.mockResolvedValue({ data: 'ok', error: null })
  upload.mockResolvedValue({ error: null })
  remove.mockResolvedValue({ error: null })
  updateEq.mockResolvedValue({ error: null })
})

describe('saveProfileSettings — validation (no writes)', () => {
  it('rejects a too-short display name', async () => {
    const res = await saveProfileSettings(idle, form({ displayName: 'A' }))
    expect(res).toMatchObject({ status: 'error', field: 'displayName' })
    expect(calls).toEqual([])
  })

  it('rejects an invalid first name', async () => {
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', firstName: 'Ania2' }))
    expect(res).toMatchObject({ status: 'error', field: 'firstName' })
    expect(calls).toEqual([])
  })

  it('rejects an out-of-range color', async () => {
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', avatarColor: '7' }))
    expect(res.status).toBe('error')
    expect(calls).toEqual([])
  })

  it('rejects a non-JPEG upload by its bytes, whatever its MIME type', async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/jpeg' })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', avatar: png }))
    expect(res).toMatchObject({ status: 'error', field: 'avatar' })
    expect(calls).toEqual([])
  })

  it('requires a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K' }))
    expect(res).toMatchObject({ status: 'error', message: 'Zaloguj się, aby zapisać zmiany.' })
    expect(calls).toEqual([])
  })
})

describe('saveProfileSettings — writes', () => {
  it('saves names and color without touching Storage', async () => {
    const res = await saveProfileSettings(idle, form({ displayName: ' Ania  K ', firstName: ' Ania ', avatarColor: '2' }))
    expect(res).toEqual({ status: 'success', message: 'Zapisano.' })
    expect(rpc).toHaveBeenCalledWith('set_first_name', { p_first_name: 'Ania' })
    expect(update).toHaveBeenCalledWith({ display_name: 'Ania K', avatar_color: 2 })
    expect(calls).toEqual(['rpc', 'update'])
  })

  it('clears the first name when blank', async () => {
    await saveProfileSettings(idle, form({ displayName: 'Ania K', firstName: '  ' }))
    expect(rpc).toHaveBeenCalledWith('set_first_name', { p_first_name: null })
  })

  it("uploads a new photo into the user's folder, then drops the old one", async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', avatar: jpeg() }))
    expect(res.status).toBe('success')
    const [path, , opts] = upload.mock.calls[0]
    expect(path).toMatch(new RegExp(`^${USER}/\\d+\\.jpg$`))
    expect(opts).toEqual({ contentType: 'image/jpeg', upsert: false })
    expect(update).toHaveBeenCalledWith({ display_name: 'Ania K', avatar_path: path })
    expect(remove).toHaveBeenCalledWith([`${USER}/1.jpg`])
    expect(calls).toEqual(['rpc', 'upload', 'update', 'remove'])
  })

  it('removes the photo on request', async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    await saveProfileSettings(idle, form({ displayName: 'Ania K', removeAvatar: '1' }))
    expect(update).toHaveBeenCalledWith({ display_name: 'Ania K', avatar_path: null })
    expect(remove).toHaveBeenCalledWith([`${USER}/1.jpg`])
  })

  it('deletes the object before clearing the path, so removal is never claimed while it is still served', async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    await saveProfileSettings(idle, form({ displayName: 'Ania K', removeAvatar: '1' }))
    expect(calls).toEqual(['rpc', 'remove', 'update'])
  })

  it('fails on the photo field and keeps the path when the removal delete fails', async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    remove.mockResolvedValue({ error: { message: 'storage down' } })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', removeAvatar: '1' }))
    expect(res).toMatchObject({ status: 'error', field: 'avatar' })
    expect(update).not.toHaveBeenCalled()
  })

  it('still succeeds when a replaced photo cannot be deleted (best effort)', async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    remove.mockResolvedValue({ error: { message: 'storage down' } })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', avatar: jpeg() }))
    expect(res.status).toBe('success')
    expect(calls).toEqual(['rpc', 'upload', 'update', 'remove'])
  })

  it('keeps the current photo when only the name changes', async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    await saveProfileSettings(idle, form({ displayName: 'Ania K' }))
    expect(update).toHaveBeenCalledWith({ display_name: 'Ania K' })
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes the fresh upload when the profile update fails, keeping the old photo', async () => {
    maybeSingle.mockResolvedValue({ data: { avatar_path: `${USER}/1.jpg` }, error: null })
    updateEq.mockResolvedValue({ error: { code: '23514' } })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', avatar: jpeg() }))
    expect(res.status).toBe('error')
    const uploaded = upload.mock.calls[0][0]
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith([uploaded])
  })

  it('stops before any other write when set_first_name fails', async () => {
    rpc.mockResolvedValue({ data: 'invalid', error: null })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', firstName: 'Ania', avatar: jpeg() }))
    expect(res).toMatchObject({ status: 'error', field: 'firstName' })
    expect(calls).toEqual(['rpc'])
  })

  it('reports a failed upload on the photo field', async () => {
    upload.mockResolvedValue({ error: { message: 'Payload too large' } })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', avatar: jpeg() }))
    expect(res).toMatchObject({ status: 'error', field: 'avatar' })
    expect(update).not.toHaveBeenCalled()
  })

  it('fails closed when the current picture cannot be read', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: '42703' } })
    const res = await saveProfileSettings(idle, form({ displayName: 'Ania K', removeAvatar: '1' }))
    expect(res.status).toBe('error')
    expect(calls).toEqual([])
  })
})
