import { describe, it, expect, vi } from 'vitest'
import { prepareGalleryImages, type GalleryPrepareDeps } from './recipe-gallery'
import type { ImageStorage } from '@/lib/image-store'
import type { ServiceReply } from './mcp/types'

const OWNER = 'ffd65e00-8f63-4a5d-993e-133cc6f30bf4'
const SOURCES = ['https://blog.example/a.jpg', 'https://blog.example/b.jpg']
const STORED = ['https://img.zapiszprzepis.pl/u/293/x-a0.webp', 'https://img.zapiszprzepis.pl/u/293/x-a1.webp']
const images = {} as ImageStorage

function setup(recipe: ServiceReply, { stored = STORED, storage = images as ImageStorage | null } = {}) {
  const rpc = vi.fn(async () => recipe)
  const archive = vi.fn(async () => stored)
  const remove = vi.fn(async () => {})
  const deps: GalleryPrepareDeps = { storage: () => storage, archive, remove }
  const run = () => prepareGalleryImages(deps)({ params: { p_recipe: 293, p_image_urls: SOURCES }, actorId: 'actor', rpc })
  return { rpc, archive, remove, run }
}

const recipe: ServiceReply = { ok: true, data: { owner_id: OWNER, image_url: 'cover', gallery: [] } }

describe('prepareGalleryImages', () => {
  it('stores the photos in the owner’s folder and hands the stored URLs to the SQL function', async () => {
    const { rpc, archive, run } = setup(recipe)
    expect(await run()).toMatchObject({ ok: true, params: { p_recipe: 293, p_image_urls: STORED } })
    expect(rpc).toHaveBeenCalledWith('admin_get_recipe_content_as', { p_actor: 'actor', p_recipe: 293 })
    expect(archive).toHaveBeenCalledWith(images, OWNER, 293, SOURCES)
  })

  it('can undo: removes exactly the files it stored', async () => {
    const { remove, run } = setup(recipe)
    const reply = await run()
    expect(remove).not.toHaveBeenCalled()
    await (reply.ok && reply.undo?.())
    expect(remove).toHaveBeenCalledWith(images, STORED)
  })

  it('stores nothing for a recipe that does not exist', async () => {
    const { archive, run } = setup({ ok: true, data: null })
    expect(await run()).toEqual({ ok: false, code: 'not_found' })
    expect(archive).not.toHaveBeenCalled()
  })

  it('passes a refusal of the read through', async () => {
    const { archive, run } = setup({ ok: false, code: 'forbidden' })
    expect(await run()).toEqual({ ok: false, code: 'forbidden' })
    expect(archive).not.toHaveBeenCalled()
  })

  it('fails with nothing written when no photo could be stored', async () => {
    const { run } = setup(recipe, { stored: [] })
    expect(await run()).toEqual({ ok: false, code: 'images_unreachable' })
  })

  it('fails outside the Worker, where no bucket is bound', async () => {
    const { archive, run } = setup(recipe, { storage: null })
    expect(await run()).toEqual({ ok: false, code: 'unknown' })
    expect(archive).not.toHaveBeenCalled()
  })
})
