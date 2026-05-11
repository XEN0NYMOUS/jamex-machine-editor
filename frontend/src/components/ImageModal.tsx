import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ChevronLeft, ChevronRight, Eye, EyeOff, Paintbrush, ImageDown } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../utils/cn'
import type { ImageItem } from '../hooks/useImageProcessing'

interface ImageModalProps {
  image: ImageItem | null
  images: ImageItem[]
  onClose: () => void
  onDownload: (id: string) => void
  onPrev: () => void
  onNext: () => void
  onEdit?: (id: string) => void
  onEditBlur?: (id: string) => void
  onEditReset?: (id: string) => void
}

export default function ImageModal({
  image,
  images,
  onClose,
  onDownload,
  onPrev,
  onNext,
  onEdit,
  onEditBlur,
  onEditReset,
}: ImageModalProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setShowOriginal(false)
    setImgError(false)
  }, [image?.id])

  useEffect(() => {
    if (!image) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        if (onEditBlur && (image.status === 'done' || image.status === 'failed')) {
          onEditBlur(image.id)
          onClose()
        } else if (onEdit && (image.status === 'done' || image.status === 'failed')) {
          onEdit(image.id)
          onClose()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault()
        if (onEditReset && (image.status === 'done' || image.status === 'failed')) {
          onEditReset(image.id)
          onClose()
        } else if (onEdit && (image.status === 'done' || image.status === 'failed')) {
          onEdit(image.id)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [image, onClose, onPrev, onNext, onEdit])

  const index = image ? images.findIndex(i => i.id === image.id) : -1
  const imgSrc = image
    ? showOriginal
      ? image.originalUrl
      : (image.previewUrl || image.originalUrl)
    : ''

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onPrev() }}
                className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onNext() }}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                style={{ right: '4rem' }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <motion.div
            key={image.id + (showOriginal ? '-orig' : '-proc')}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex max-h-full max-w-full flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {imgError ? (
              <div className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg bg-muted">
                <ImageDown className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Image unavailable</p>
              </div>
            ) : (
              <img
                src={imgSrc}
                alt={image.file.name}
                className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
                onError={() => setImgError(true)}
              />
            )}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-white/70">
                {image.file.name}
                {images.length > 1 && ` (${index + 1}/${images.length})`}
              </span>
              {image.previewUrl && (
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    showOriginal
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-primary/20 text-primary-foreground/80 hover:bg-primary/30',
                  )}
                >
                  {showOriginal ? (
                    <><Eye className="h-3.5 w-3.5" /> Show Processed</>
                  ) : (
                    <><EyeOff className="h-3.5 w-3.5" /> Show Original</>
                  )}
                </button>
              )}
              {onEdit && (image.status === 'done' || image.status === 'failed') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { onEdit(image.id); onClose() }}
                  className="gap-1.5"
                >
                  <Paintbrush className="h-4 w-4" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDownload(image.id)}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
