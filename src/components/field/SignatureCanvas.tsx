import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'

interface SignatureCanvasProps {
  onCapture: (blob: Blob) => void
}

export function SignatureCanvas({ onCapture }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  const getCoords = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return null
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function startDraw(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      const coords = getCoords(e)
      if (!coords) return
      setIsDrawing(true)
      ctx!.beginPath()
      ctx!.moveTo(coords.x, coords.y)
    }

    function draw(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      if (!isDrawing) return
      const coords = getCoords(e)
      if (!coords) return
      ctx!.lineTo(coords.x, coords.y)
      ctx!.stroke()
      setHasContent(true)
    }

    function endDraw(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      setIsDrawing(false)
    }

    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', endDraw)
    canvas.addEventListener('mouseleave', endDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', endDraw, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', endDraw)
      canvas.removeEventListener('mouseleave', endDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', endDraw)
    }
  }, [isDrawing, getCoords])

  function handleClear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
  }

  function handleAccept() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob)
    }, 'image/png')
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Signature</label>
      <div className="rounded-lg border border-surface-border bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 150, touchAction: 'none' }}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleClear} type="button">
          Clear
        </Button>
        <Button size="sm" onClick={handleAccept} disabled={!hasContent} type="button">
          Accept Signature
        </Button>
      </div>
    </div>
  )
}
