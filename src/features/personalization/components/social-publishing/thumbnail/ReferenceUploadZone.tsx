'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import type { ThumbnailState } from '../types';

export interface ReferenceUploadZoneProps {
  templateId: string | undefined
  references: string[]
  onUpdate: (thumbnail: Partial<ThumbnailState>) => void
  disabled?: boolean
}

const TEMPLATE_REFERENCE_MAP: Record<string, { type: string; label: string; accept: string }> = {
  'creator-reaction': { type: 'photo', label: 'Face photo (optional)', accept: 'image/*' },
  'product-hero': { type: 'product', label: 'Product image', accept: 'image/*' },
  'workspace-makeover': { type: 'room', label: 'Room photo (optional)', accept: 'image/*' },
  'face-reveal': { type: 'photo', label: 'Face reference', accept: 'image/*' },
  'lifestyle-blog': { type: 'photo', label: 'Lifestyle photo (optional)', accept: 'image/*' },
  'business-podcast': { type: 'photo', label: 'Headshot (optional)', accept: 'image/*' },
  'product-showcase': { type: 'product', label: 'Product image', accept: 'image/*' },
  'product-360': { type: 'product', label: 'Product image (multiple)', accept: 'image/*' },
  'product-video-ad': { type: 'product', label: 'Product image', accept: 'image/*' },
  'product-redesigner': { type: 'product', label: 'Product image', accept: 'image/*' },
  'interior-design': { type: 'room', label: 'Room reference photo', accept: 'image/*' },
  'room-style-transformation': { type: 'room', label: 'Room reference photo', accept: 'image/*' },
  'ai-interior-makeover': { type: 'room', label: 'Room reference photo', accept: 'image/*' },
  'ai-home-decor': { type: 'room', label: 'Room reference photo', accept: 'image/*' },
  'virtual-furniture-staging': { type: 'room', label: 'Room photo', accept: 'image/*' },
  'ai-real-estate': { type: 'room', label: 'Property photo', accept: 'image/*' },
  'ai-book-cover': { type: 'photo', label: 'Author photo (optional)', accept: 'image/*' },
  'logo-transformer': { type: 'product', label: 'Logo file', accept: 'image/*' },
  'fashion-headshots': { type: 'photo', label: 'Current headshot (optional)', accept: 'image/*' },
  'couple-photo-grid': { type: 'photo', label: 'Photo (optional)', accept: 'image/*' },
  'double-exposure': { type: 'photo', label: 'Portrait photo', accept: 'image/*' },
  'selfie-celebrities': { type: 'photo', label: 'Your photo', accept: 'image/*' },
  'ai-action-figure': { type: 'photo', label: 'Face reference', accept: 'image/*' },
  'multi-angle-reshoot': { type: 'photo', label: 'Original photo', accept: 'image/*' },
  'jewelry-product-video': { type: 'product', label: 'Jewelry photo', accept: 'image/*' },
  'furniture-photography': { type: 'product', label: 'Furniture photo', accept: 'image/*' },
  'giant-product-showcase': { type: 'product', label: 'Product image', accept: 'image/*' },
  'street-portrait': { type: 'photo', label: 'Portrait reference', accept: 'image/*' },
  'virtual-try-on': { type: 'photo', label: 'Model photo', accept: 'image/*' },
}

const DEFAULT_REF = { type: 'photo', label: 'Reference image (optional)', accept: 'image/*' }

export default function ReferenceUploadZone({ templateId, references, onUpdate, disabled }: ReferenceUploadZoneProps) {
  const config = templateId ? (TEMPLATE_REFERENCE_MAP[templateId] || DEFAULT_REF) : DEFAULT_REF
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const url = e.target?.result as string
        onUpdate({ references: [...references, url] })
      }
      reader.readAsDataURL(file)
    })
  }, [references, onUpdate])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removeReference = useCallback((index: number) => {
    onUpdate({ references: references.filter((_, i) => i !== index) })
  }, [references, onUpdate])

  const hasMultiple = config.type === 'product' && templateId !== 'logo-transformer'

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-white/40">
        {config.label}
      </p>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !disabled && inputRef.current?.click() }}
        aria-label={`Upload ${config.type} reference`}
        className={`
          flex flex-col items-center justify-center gap-2 p-4 rounded-xl cursor-pointer
          border-2 border-dashed transition-all
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-[#d9ff00]/40'}
          ${dragOver ? 'border-[#d9ff00]/60 bg-[#d9ff00]/5' : 'border-white/10 bg-white/[0.02]'}
        `}
      >
        <Upload size={16} className="text-white/30" />
        <p className="text-[10px] text-white/40 text-center">
          Drop {config.type} here or click to upload
          {hasMultiple ? ' (up to 4)' : ''}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          multiple={hasMultiple}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Reference previews */}
      {references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {references.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeReference(i)}
                aria-label={`Remove reference ${i + 1}`}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
