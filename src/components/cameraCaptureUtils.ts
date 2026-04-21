import type { CaptureSettings } from './types'

type SourceCrop = {
  x: number
  y: number
  width: number
  height: number
}

export function buildVideoConstraints(settings: CaptureSettings): MediaTrackConstraints {
  const preferredWidth = clampDimension(Math.max(settings.width * 2, 1920), 1920, 4096)
  const preferredHeight = clampDimension(Math.max(settings.height * 2, 1440), 1080, 3072)

  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: preferredWidth },
    height: { ideal: preferredHeight },
    aspectRatio: { ideal: settings.width / settings.height },
  }
}

export function formatResolution(width?: number, height?: number) {
  if (!width || !height) {
    return ''
  }

  return `${width} x ${height}`
}

export async function captureFromPreview(
  video: HTMLVideoElement,
  viewport: HTMLDivElement,
  frame: HTMLDivElement,
  settings: CaptureSettings,
) {
  const previewCrop = getPreviewCrop(video, viewport, frame, settings.width / settings.height)
  return renderSourceToBlob(video, settings, previewCrop)
}

export function downloadCapture(url: string, timestamp: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = `camera-shot-${timestamp}.jpg`
  link.click()
}

function drawFrameToCanvas(
  source: CanvasImageSource,
  context: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
  previewCrop?: SourceCrop,
) {
  const { width: sourceWidth, height: sourceHeight } = readSourceDimensions(source)
  const crop = previewCrop
    ? previewCrop
    : getCenteredCrop(sourceWidth, sourceHeight, targetWidth / targetHeight)

  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  )
}

function readSourceDimensions(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth,
      height: source.videoHeight,
    }
  }

  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth,
      height: source.naturalHeight,
    }
  }

  if (source instanceof ImageBitmap) {
    return {
      width: source.width,
      height: source.height,
    }
  }

  return {
    width: 0,
    height: 0,
  }
}

async function renderSourceToBlob(
  source: CanvasImageSource,
  settings: CaptureSettings,
  previewCrop?: SourceCrop,
) {
  const canvas = document.createElement('canvas')
  canvas.width = settings.width
  canvas.height = settings.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  drawFrameToCanvas(source, context, settings.width, settings.height, previewCrop)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.96)
  })
}

function getPreviewCrop(
  video: HTMLVideoElement,
  viewport: HTMLDivElement,
  frame: HTMLDivElement,
  targetRatio: number,
): SourceCrop {
  const viewportRect = viewport.getBoundingClientRect()
  const frameRect = frame.getBoundingClientRect()

  const scale = Math.max(
    viewportRect.width / video.videoWidth,
    viewportRect.height / video.videoHeight,
  )

  const displayedWidth = video.videoWidth * scale
  const displayedHeight = video.videoHeight * scale
  const displayedLeft = (viewportRect.width - displayedWidth) / 2
  const displayedTop = (viewportRect.height - displayedHeight) / 2

  const relativeLeft = frameRect.left - viewportRect.left
  const relativeTop = frameRect.top - viewportRect.top
  const relativeCenterX = relativeLeft + frameRect.width / 2
  const relativeCenterY = relativeTop + frameRect.height / 2

  const centerX = (relativeCenterX - displayedLeft) / scale
  const centerY = (relativeCenterY - displayedTop) / scale

  const widthFromFrame = frameRect.width / scale
  const heightFromFrame = frameRect.height / scale
  const fittedWidth = Math.min(widthFromFrame, heightFromFrame * targetRatio)
  const fittedHeight = fittedWidth / targetRatio

  const halfWidth = fittedWidth / 2
  const halfHeight = fittedHeight / 2

  const x = clamp(centerX - halfWidth, 0, video.videoWidth - fittedWidth)
  const y = clamp(centerY - halfHeight, 0, video.videoHeight - fittedHeight)

  return {
    x,
    y,
    width: fittedWidth,
    height: fittedHeight,
  }
}

function getCenteredCrop(sourceWidth: number, sourceHeight: number, targetRatio: number) {
  const sourceRatio = sourceWidth / sourceHeight

  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio
    return {
      x: (sourceWidth - width) / 2,
      y: 0,
      width,
      height: sourceHeight,
    }
  }

  const height = sourceWidth / targetRatio
  return {
    x: 0,
    y: (sourceHeight - height) / 2,
    width: sourceWidth,
    height,
  }
}

function clampDimension(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
