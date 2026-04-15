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

type NativeImageCapture = {
  takePhoto: () => Promise<Blob>
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
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<'starting' | 'ready' | 'denied' | 'error'>(
    'starting',
  )
  const [error, setError] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [sourceResolution, setSourceResolution] = useState('')
  const [captureMethod, setCaptureMethod] = useState<'imageCapture' | 'video'>(
    'video',
  )

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
      setCaptureMethod(getImageCaptureInstance(track) ? 'imageCapture' : 'video')
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
    setCaptureMethod('video')
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

    if (!video || video.videoWidth === 0 || video.videoHeight === 0 || !track) {
      setError('Камера еще не готова. Подождите немного и попробуйте снова.')
      return
    }

    setIsCapturing(true)
    setError('')

    try {
      const photoBlob =
        (await captureFromPhoto(track, settings)) ??
        (await captureFromVideo(video, settings))

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
            <span>{captureMethod === 'imageCapture' ? 'photo' : 'video'}</span>
          </div>
        )}
      </div>

      <div className="camera-screen__viewport">
        <video
          ref={videoRef}
          className="camera-screen__video"
          autoPlay
          muted
          playsInline
        />

        {status === 'ready' && (
          <div className="camera-screen__overlay">
            <div className="camera-screen__frame" style={frameStyle}>
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
) {
  const { width: sourceWidth, height: sourceHeight } = readSourceDimensions(source)
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight

  let cropWidth = sourceWidth
  let cropHeight = sourceHeight
  let cropX = 0
  let cropY = 0

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio
    cropX = (sourceWidth - cropWidth) / 2
  } else {
    cropHeight = sourceWidth / targetRatio
    cropY = (sourceHeight - cropHeight) / 2
  }

  context.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
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

function getImageCaptureInstance(track: MediaStreamTrack | undefined) {
  if (!track) {
    return null
  }

  const ImageCaptureCtor = (
    globalThis as typeof globalThis & {
      ImageCapture?: new (mediaStreamTrack: MediaStreamTrack) => NativeImageCapture
    }
  ).ImageCapture

  if (!ImageCaptureCtor) {
    return null
  }

  try {
    return new ImageCaptureCtor(track)
  } catch {
    return null
  }
}

async function captureFromPhoto(track: MediaStreamTrack, settings: CaptureSettings) {
  const imageCapture = getImageCaptureInstance(track)
  if (!imageCapture) {
    return null
  }

  try {
    const photoBlob = await imageCapture.takePhoto()
    const imageUrl = URL.createObjectURL(photoBlob)

    try {
      const image = await loadImage(imageUrl)
      return renderSourceToBlob(image, settings)
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  } catch {
    return null
  }
}

async function captureFromVideo(video: HTMLVideoElement, settings: CaptureSettings) {
  return renderSourceToBlob(video, settings)
}

async function renderSourceToBlob(source: CanvasImageSource, settings: CaptureSettings) {
  const canvas = document.createElement('canvas')
  canvas.width = settings.width
  canvas.height = settings.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  drawFrameToCanvas(source, context, settings.width, settings.height)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.96)
  })
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = url
  })
}

function downloadCapture(url: string, timestamp: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = `camera-shot-${timestamp}.jpg`
  link.click()
}
