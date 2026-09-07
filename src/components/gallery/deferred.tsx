import { lazy } from 'react'
import '../../styles/gallery.css'

export const GalleryAdmin = lazy(() => import('./GalleryAdmin').then(module => ({ default: module.GalleryAdmin })))
export const GalleryBrowse = lazy(() => import('./GalleryBrowse').then(module => ({ default: module.GalleryBrowse })))
export const GallerySubmission = lazy(() => import('./GallerySubmission').then(module => ({ default: module.GallerySubmission })))
