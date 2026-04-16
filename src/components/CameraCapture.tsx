import { useCallback, useEffect, useRef, useState } from 'react'

type CaptureSettings = {
  width: number
  height: number
}

type CaptureResult = {
  url: string
  width: number
  height: number
  timestamp: string
}

type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean
}

type TorchConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean
}

type CameraCaptureProps = {
  settings: CaptureSettings
  onBack: () => void
  onClose: () => void
  onCapture: (result: CaptureResult) => void
}

export function CameraCapture({
  settings,
  onBack,
  onClose,
  onCapture,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<'starting' | 'ready' | 'denied' | 'error'>(
    'starting',
  )
  const [error, setError] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [sourceResolution, setSourceResolution] = useState('')

  const startCamera = useCallback(async () => {
    setStatus('starting')
    setError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(settings),
      })

      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }

      const [track] = stream.getVideoTracks()
      const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined
      const trackSettings = track?.getSettings?.()

      setTorchSupported(Boolean(capabilities?.torch))
      setTorchEnabled(false)
      setSourceResolution(
        formatResolution(
          trackSettings?.width ?? video?.videoWidth,
          trackSettings?.height ?? video?.videoHeight,
        ),
      )
      setStatus('ready')
    } catch (cameraError) {
      const name =
        cameraError instanceof DOMException ? cameraError.name : 'UnknownError'

      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied')
        setError(
          'Доступ к камере запрещен. Разрешите его в настройках браузера и попробуйте снова.',
        )
        return
      }

      setStatus('error')
      setError('Не удалось открыть камеру. Попробуйте еще раз чуть позже.')
    }
  }, [settings])

  useEffect(() => {
    void startCamera()

    return () => {
      stopCamera()
    }
  }, [startCamera])

  function stopCamera() {
    const stream = streamRef.current
    if (!stream) {
      return
    }

    for (const track of stream.getTracks()) {
      track.stop()
    }

    streamRef.current = null
    setTorchSupported(false)
    setTorchEnabled(false)
    setSourceResolution('')
  }

  async function handleTorchToggle() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !torchSupported) {
      return
    }

    const nextValue = !torchEnabled

    try {
      await track.applyConstraints({
        advanced: [{ torch: nextValue } as TorchConstraintSet],
      })
      setTorchEnabled(nextValue)
      setError('')
    } catch {
      setTorchSupported(false)
      setTorchEnabled(false)
      setError('В этом браузере управление вспышкой недоступно.')
    }
  }

  async function handleCapture() {
    const video = videoRef.current
    const track = streamRef.current?.getVideoTracks()[0]
    const viewport = viewportRef.current
    const frame = frameRef.current

    if (
      !video ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      !track ||
      !viewport ||
      !frame
    ) {
      setError('Камера еще не готова. Подождите немного и попробуйте снова.')
      return
    }

    setIsCapturing(true)
    setError('')

    try {
      const previewCrop = getPreviewCrop(
        video,
        viewport,
        frame,
        settings.width / settings.height,
      )
      const photoBlob = await captureFromVideo(video, settings, previewCrop)

      if (!photoBlob) {
        throw new Error('Failed to create image')
      }

      const timestamp = new Date().toISOString().replaceAll(':', '-')
      const url = URL.createObjectURL(photoBlob)

      onCapture({
        url,
        width: settings.width,
        height: settings.height,
        timestamp,
      })

      downloadCapture(url, timestamp)
      stopCamera()
      onBack()
    } catch {
      setError('Не удалось сохранить фото. Попробуйте сделать снимок еще раз.')
    } finally {
      setIsCapturing(false)
    }
  }

  const frameStyle = {
    aspectRatio: `${settings.width} / ${settings.height}`,
  }

  return (
    <section className="camera-screen">
      <div className="camera-screen__topbar">
        <div className="camera-screen__topbar-group">
          <button className="ghost-action" type="button" onClick={onClose}>
            Закрыть
          </button>
          {torchSupported && status === 'ready' && (
            <button
              className={`camera-toggle ${torchEnabled ? 'camera-toggle--active' : ''}`}
              type="button"
              onClick={() => void handleTorchToggle()}
              aria-label={torchEnabled ? 'Выключить вспышку' : 'Включить вспышку'}
            >
              {torchEnabled ? 'Вспышка: вкл' : 'Вспышка'}
            </button>
          )}
        </div>

        {sourceResolution && (
          <div className="camera-screen__quality-chip">
            {sourceResolution}
            <span>preview</span>
          </div>
        )}
      </div>

      <div className="camera-screen__viewport" ref={viewportRef}>
        <video
          ref={videoRef}
          className="camera-screen__video"
          autoPlay
          muted
          playsInline
        />

        {status === 'ready' && (
          <div className="camera-screen__overlay">
            <div className="camera-screen__frame" style={frameStyle} ref={frameRef}>
              <div className="camera-screen__grid" />
            </div>
          </div>
        )}

        {status !== 'ready' && (
          <div className="camera-screen__message">
            <strong>
              {status === 'starting'
                ? 'Подключаем камеру...'
                : status === 'denied'
                  ? 'Доступ запрещен'
                  : 'Камера недоступна'}
            </strong>
            <p>{error}</p>
            <div className="camera-screen__fallback-actions">
              {status !== 'starting' && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => void startCamera()}
                >
                  Повторить попытку
                </button>
              )}
              <button className="primary-action" type="button" onClick={onBack}>
                Вернуться к параметрам
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="camera-screen__bottomsheet">
        {error && status === 'ready' && <p className="status-message error">{error}</p>}

        <div className="camera-screen__capture-bar">
          <button
            className="capture-button"
            type="button"
            onClick={() => void handleCapture()}
            disabled={status !== 'ready' || isCapturing}
            aria-label={isCapturing ? 'Сохраняем фото' : 'Сделать фото'}
          >
            <span className="capture-button__inner" />
          </button>
        </div>
      </div>
    </section>
  )
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

function buildVideoConstraints(settings: CaptureSettings): MediaTrackConstraints {
  const preferredWidth = clampDimension(Math.max(settings.width * 2, 1920), 1920, 4096)
  const preferredHeight = clampDimension(Math.max(settings.height * 2, 1440), 1080, 3072)

  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: preferredWidth },
    height: { ideal: preferredHeight },
    aspectRatio: { ideal: settings.width / settings.height },
  }
}

function clampDimension(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function formatResolution(width?: number, height?: number) {
  if (!width || !height) {
    return ''
  }

  return `${width} x ${height}`
}

async function captureFromVideo(
  video: HTMLVideoElement,
  settings: CaptureSettings,
  previewCrop?: SourceCrop,
) {
  return renderSourceToBlob(video, settings, previewCrop)
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

type SourceCrop = {
  x: number
  y: number
  width: number
  height: number
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function downloadCapture(url: string, timestamp: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = `camera-shot-${timestamp}.jpg`
  link.click()
}
