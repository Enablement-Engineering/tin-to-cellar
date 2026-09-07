import { beforeEach, expect, it, vi } from 'vitest'
import worker, { type Env } from './index'
import { cleanGallery } from './gallery/routes'
import { cleanDiagnostics } from './diagnostics'
import { verifyGalleryAdmin } from './gallery/auth'
vi.mock('./gallery/routes', async importOriginal => ({...await importOriginal<typeof import('./gallery/routes')>(),cleanGallery:vi.fn()}))
vi.mock('./diagnostics', async importOriginal => ({...await importOriginal<typeof import('./diagnostics')>(),cleanDiagnostics:vi.fn()}))
vi.mock('./gallery/auth', async importOriginal => ({...await importOriginal<typeof import('./gallery/auth')>(),verifyGalleryAdmin:vi.fn()}))
beforeEach(()=>{vi.clearAllMocks();vi.mocked(cleanGallery).mockResolvedValue({deleted:0,failures:0,orphans:0});vi.mocked(cleanDiagnostics).mockResolvedValue(undefined);vi.mocked(verifyGalleryAdmin).mockResolvedValue(null)})
function environment():Env{return {ASSETS:{fetch:vi.fn(async()=>new Response('<html>shell</html>',{headers:{'Cache-Control':'public,max-age=86400'}}))},DIAGNOSTICS:{} as Env['DIAGNOSTICS']}}
it('protects the admin shell and nested paths on every hostname',async()=>{
 const env=environment()
 for(const origin of ['https://tintocellar.com','https://www.tintocellar.com','https://alternate.workers.dev'])for(const path of ['/admin/gallery','/admin/gallery/anything']){
  const response=await worker.fetch(new Request(origin+path),env);expect(response.status).toBe(403);expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer')
 }
 expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})
it('overrides asset caching for authenticated review and private status shells',async()=>{
 const env=environment();vi.mocked(verifyGalleryAdmin).mockResolvedValue('fixture-admin')
 for(const path of ['/admin/gallery','/gallery/status']){const response=await worker.fetch(new Request('https://site.example'+path),env);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer')}
})
it('keeps gallery cleanup running after diagnostics cleanup failure',async()=>{
 const env=environment();vi.mocked(cleanDiagnostics).mockRejectedValue(Error('fixture diagnostics failure'))
 await expect(worker.scheduled({},env)).rejects.toThrow('Scheduled cleanup incomplete');expect(cleanGallery).toHaveBeenCalledWith(env)
})
it('reports counted gallery failures while completing diagnostics cleanup',async()=>{
 const env=environment();vi.mocked(cleanGallery).mockResolvedValue({deleted:1,failures:2,orphans:0})
 await expect(worker.scheduled({},env)).rejects.toThrow('Scheduled cleanup incomplete');expect(cleanDiagnostics).toHaveBeenCalledWith(env.DIAGNOSTICS)
})
it('runs both retention cleanups while reporting failed legacy diagnostics migration',async()=>{
 const env=environment();env.CATALOG_CONTRIBUTIONS={getByName:()=>({fetch:async()=>new Response(null,{status:503})})}
 await expect(worker.scheduled({},env)).rejects.toThrow('Scheduled cleanup incomplete');expect(cleanGallery).toHaveBeenCalledWith(env);expect(cleanDiagnostics).toHaveBeenCalledExactlyOnceWith(env.DIAGNOSTICS)
})
it('completes a healthy scheduled run without requiring provisioned gallery bindings',async()=>{await expect(worker.scheduled({},environment())).resolves.toBeUndefined()})
