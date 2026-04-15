import { useEffect, useRef, useState } from 'react'

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

  useEffect(() => {
    void startCamera()

    return () => {
      stopCamera()
    }
  }, [])

  async function startCamera() {
    setStatus('starting')
    setError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      })

      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }

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
      setError(
        'Не удалось открыть камеру. Попробуйте еще раз чуть позже.',
      )
    }
  }

  function stopCamera() {
    const stream = streamRef.current
    if (!stream) {
      return
    }

    for (const track of stream.getTracks()) {
      track.stop()
    }

    streamRef.current = null
  }

  async function handleCapture() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Камера еще не готова. Подождите немного и попробуйте снова.')
      return
    }

    setIsCapturing(true)
    setError('')

    try {
      const canvas = document.createElement('canvas')
      canvas.width = settings.width
      canvas.height = settings.height

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas is unavailable')
      }

      drawFrameToCanvas(video, context, settings.width, settings.height)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      })

      if (!blob) {
        throw new Error('Failed to create image')
      }

      const timestamp = new Date().toISOString().replaceAll(':', '-')
      const url = URL.createObjectURL(blob)

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
        <div className="camera-screen__topbar-actions">
          <button className="ghost-action" type="button" onClick={onBack}>
            Назад
          </button>
          <button className="ghost-action" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="camera-screen__meta">
          <strong>
            {settings.width} x {settings.height}
          </strong>
          <span>Снимок сохранится ровно в этом размере</span>
        </div>
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
        <p className="helper-text">
          Фото будет обрезано строго по светлой рамке. В финальный файл попадет
          только область внутри нее.
        </p>

        {error && status === 'ready' && <p className="status-message error">{error}</p>}

        <div className="camera-screen__actions">
          <button className="ghost-action" type="button" onClick={onBack}>
            Изменить параметры
          </button>
          <button
            className="capture-button"
            type="button"
            onClick={() => void handleCapture()}
            disabled={status !== 'ready' || isCapturing}
          >
            {isCapturing ? 'Сохраняем...' : 'Сделать фото'}
          </button>
        </div>
      </div>
    </section>
  )
}

function drawFrameToCanvas(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
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
    video,
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

function downloadCapture(url: string, timestamp: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = `camera-shot-${timestamp}.jpg`
  link.click()
}
