import type { GalleryLabelDraftV1, GalleryReviewRecord, GalleryState } from '../../src/lib/gallery/types'
import { uuid } from '../../src/lib/gallery/schema'
import type { GalleryDatabase } from './storage'
export interface StoredReviewRow {id:string;state:GalleryState;row_version:number;created_at:string;expires_at:string;metadata_json:string|null;metadata_hash:string|null;artwork_hash:string|null;digest:string|null;catalog_id:string|null;deletion_due:string|null;publication_id:string|null;published_maker:string|null;published_blend:string|null}
export async function reviewRecord(db:GalleryDatabase,row:StoredReviewRow,now:Date):Promise<GalleryReviewRecord>{
 const readable=row.state==='published'||(row.deletion_due?row.deletion_due>now.toISOString():row.expires_at>now.toISOString())
 const metadata:GalleryLabelDraftV1|null=readable&&row.metadata_json?JSON.parse(row.metadata_json):null
 const tobacco=row.catalog_id?await db.prepare('SELECT maker,blend FROM gallery_tobaccos WHERE id=?').bind(row.catalog_id).first<{maker:string;blend:string}>():null
 return{id:row.id,state:row.state,version:row.row_version,createdAt:row.created_at,expiresAt:row.expires_at,deletionDue:row.deletion_due,digest:row.digest,metadata,publicationId:row.publication_id,maker:tobacco?.maker??metadata?.proposedIdentity?.maker??null,blend:tobacco?.blend??metadata?.proposedIdentity?.blend??null,mappingNeeded:!row.catalog_id,canonicalHash:readable?row.artwork_hash:null,metadataHash:readable?row.metadata_hash:null,uploadedHash:metadata?.image.sha256??null,publishedIdentity:row.published_maker&&row.published_blend?{maker:row.published_maker,blend:row.published_blend}:null,validation:{format:'gallery-v1',geometry:'circle-2.5',imageValidated:!!row.artwork_hash,visualReviewRequired:true}}
}
export function readCursor(value:string|null,activity=false):[string,string]{if(!value)return['',''];if(value.length>(activity?300:200))throw Error('invalid_filter');try{const [date,id,...rest]=atob(value.replace(/-/g,'+').replace(/_/g,'/')).split('|');if(rest.length||(activity?!/^[A-Za-z0-9:._-]{1,160}$/.test(id):!uuid(id))||!Number.isFinite(Date.parse(date))||new Date(date).toISOString()!==date)throw Error();return[date,id]}catch{throw Error('invalid_filter')}}
export const nextCursor=(row:Pick<StoredReviewRow,'created_at'|'id'>)=>btoa(`${row.created_at}|${row.id}`).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
export async function humanQueue(db:GalleryDatabase,url:URL,now:Date){
 const [created,id]=readCursor(url.searchParams.get('cursor'));const state=url.searchParams.get('state')??'pending';const search=url.searchParams.get('search')??'';const mapping=url.searchParams.get('mappingNeeded')??''
 if(!['','reserved','uploading','pending','preparing-publication','published','unpublished','rejected','withdrawn','expired','deleting','deleted'].includes(state)||search.length>160||!['','true','false'].includes(mapping))throw Error('invalid_filter')
 const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%'
 const rows=(await db.prepare(`SELECT s.* FROM gallery_submissions s LEFT JOIN gallery_tobaccos c ON c.id=s.catalog_id
 WHERE (?='' OR s.state=?) AND (?='' OR (s.catalog_id IS NULL)=?)
 AND (?='' OR coalesce(c.maker,json_extract(s.metadata_json,'$.proposedIdentity.maker'),'') LIKE ? ESCAPE '\\' OR coalesce(c.blend,json_extract(s.metadata_json,'$.proposedIdentity.blend'),'') LIKE ? ESCAPE '\\')
 AND (s.created_at>? OR(s.created_at=? AND s.id>?)) ORDER BY s.created_at,s.id LIMIT 25`).bind(state,state,mapping,mapping==='true'?1:0,search,pattern,pattern,created,created,id).all<StoredReviewRow>()).results
 const counts=await db.prepare("SELECT COALESCE(SUM(CASE WHEN state='pending' THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(reserved_bytes),0) AS reservedBytes,MIN(CASE WHEN state='pending' THEN created_at ELSE NULL END) AS oldestPendingAt,COALESCE(SUM(CASE WHEN state='deleting' THEN 1 ELSE 0 END),0) AS cleanupWaiting FROM gallery_submissions").first()
 return{submissions:await Promise.all(rows.slice(0,24).map(row=>reviewRecord(db,row,now))),nextCursor:rows.length>24?nextCursor(rows[23]):null,counts}
}
