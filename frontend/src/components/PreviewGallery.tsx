import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImageDown, Eye, EyeOff } from 'lucide-react'
import ImageCard from './ImageCard'
import ImageModal from './ImageModal'
import ImageEditor from './editor/ImageEditor'
import { Button } from './ui/button'
import { cn } from '../utils/cn'
import type { ImageItem } from '../hooks/useImageProcessing'

interface PreviewGalleryProps {
  images: ImageItem[]
  onDownloadOne: (id: string) => void
  onSaveEdit?: (imageId: string, dataUrl: string) => void
  onDelete?: (id: string) => void
  onReorder?: (images: ImageItem[]) => void
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

export default function PreviewGallery({
  images,
  onDownloadOne,
  onSaveEdit,
  onDelete,
  onReorder,
}: PreviewGalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const dragOverIndex = useRef<number | null>(null)
  const startOriginalRef = useRef(false)
  const [editBlur, setEditBlur] = useState(() => {
    try { return localStorage.getItem('jamex_editBlur') === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('jamex_editBlur', String(editBlur)) } catch {}
  }, [editBlur])

  const expanded = images.find(i => i.id === expandedId) || null
  const editing = images.find(i => i.id === editId) || null

  const editable = images.filter((i) => i.status === 'done' || i.status === 'failed')
  const editIndex = editing ? editable.findIndex((i) => i.id === editing.id) : -1
  const hasPrev = editIndex > 0
  const hasNext = editIndex < editable.length - 1

  const onEditPrev = useCallback(() => {
    if (editIndex > 0) setEditId(editable[editIndex - 1].id)
  }, [editable, editIndex])

  const onEditNext = useCallback(() => {
    if (editIndex < editable.length - 1) setEditId(editable[editIndex + 1].id)
  }, [editable, editIndex])

  const onPrev = useCallback(() => {
    const idx = images.findIndex(i => i.id === expandedId)
    if (idx > 0) setExpandedId(images[idx - 1].id)
  }, [images, expandedId])

  const onNext = useCallback(() => {
    const idx = images.findIndex(i => i.id === expandedId)
    if (idx < images.length - 1) setExpandedId(images[idx + 1].id)
  }, [images, expandedId])

  const doneCount = images.filter(i => i.status === 'done').length

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    dragOverIndex.current = null
  }, [])

  const handleEditBlur = useCallback((id: string) => {
    setEditBlur(true)
    setEditId(id)
  }, [])

  const handleEditReset = useCallback((id: string) => {
    startOriginalRef.current = true
    setEditBlur(false)
    setEditId(id)
  }, [])

  const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverIndex.current = index
  }, [])

  const handleDrop = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
    if (isNaN(fromIndex) || fromIndex === index) {
      setDragIndex(null)
      return
    }
    const reordered = [...images]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(index, 0, moved)
    onReorder?.(reordered)
    setDragIndex(null)
    dragOverIndex.current = null
  }, [images, onReorder])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Preview Gallery
          {images.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({images.length} image{images.length !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
        {doneCount > 0 && (
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setShowOriginal(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                showOriginal
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <EyeOff className="h-3.5 w-3.5" />
              Original
            </button>
            <button
              onClick={() => setShowOriginal(false)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                !showOriginal
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Processed
            </button>
          </div>
        )}
      </div>
      <AnimatePresence mode="popLayout">
        {images.length > 0 ? (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {images.map((img, idx) => (
              <ImageCard
                key={img.id}
                image={img}
                showOriginal={showOriginal}
                onDownload={onDownloadOne}
                onExpand={setExpandedId}
                onEdit={setEditId}
                onDelete={onDelete}
                dragHandleProps={{
                  onDragStart: handleDragStart(idx),
                  onDragEnd: handleDragEnd,
                }}
                isDragging={dragIndex === idx}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 py-16"
          >
            <ImageDown className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Upload images to see previews
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <ImageModal
        image={expanded}
        images={images}
        onClose={() => setExpandedId(null)}
        onDownload={onDownloadOne}
        onPrev={onPrev}
        onNext={onNext}
        onEdit={setEditId}
        onEditBlur={handleEditBlur}
        onEditReset={handleEditReset}
      />

      {(expandedId || editId) && (
        <div className="fixed inset-0 z-40 bg-black" />
      )}

      <AnimatePresence>
        {editing && (
          <ImageEditor
            key={editing.id + (startOriginalRef.current ? '-orig' : '')}
            originalUrl={editing.originalUrl}
            processedUrl={startOriginalRef.current ? editing.originalUrl : (editing.previewUrl || editing.originalUrl)}
            filename={editing.file.name}
            initialTool={editBlur ? 'blur' : undefined}
            onClose={() => { startOriginalRef.current = false; setEditId(null) }}
            onSave={onSaveEdit ? (dataUrl) => onSaveEdit(editing.id, dataUrl) : undefined}
            onNext={editable.length > 1 ? onEditNext : undefined}
            onPrev={editable.length > 1 ? onEditPrev : undefined}
            hasNext={hasNext}
            hasPrev={hasPrev}
            currentIndex={editIndex}
            totalImages={editable.length}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
