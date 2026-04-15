import { useEffect, useRef, useState } from 'react'

type CameraCaptureProps = {
  onClose: () => void
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

const DEFAULT_WIDTH = 1600
const DEFAULT_HEIGHT = 1200

export function CameraCapture({ onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastCaptureUrlRef = useRef<string | null>(null)

  const [isStarting, setIsStarting] = useState(true)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [error, setError] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [targetWidth, setTargetWidth] = useState(DEFAULT_WIDTH)
  const [targetHeight, setTargetHeight] = useState(DEFAULT_HEIGHT)
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null)

  useEffect(() => {
    void startCamera()

    return () => {
      stopCamera()
      cleanupLastCaptureUrl()
    }
  }, [])

  async function startCamera() {
    setIsStarting(true)
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

      const [track] = stream.getVideoTracks()
      const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined

      setTorchSupported(Boolean(capabilities?.torch))
      setTorchEnabled(false)
      setIsCameraReady(true)
    } catch (cameraError) {
      const message =
        cameraError instanceof Error
          ? cameraError.message
          : 'Не удалось открыть камеру.'

      setError(
        `Не удалось получить доступ к камере. Проверьте разрешение браузера. ${message}`,
      )
      setIsCameraReady(false)
    } finally {
      setIsStarting(false)
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
    setIsCameraReady(false)
    setTorchSupported(false)
    setTorchEnabled(false)
  }

  function cleanupLastCaptureUrl() {
    if (lastCaptureUrlRef.current) {
      URL.revokeObjectURL(lastCaptureUrlRef.current)
      lastCaptureUrlRef.current = null
    }
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
      setError(
        'На этом устройстве вспышкой нельзя управлять из браузера. Камера продолжит работать без нее.',
      )
      setTorchSupported(false)
      setTorchEnabled(false)
    }
  }

  async function handleCapture() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Камера еще не готова. Попробуйте через секунду.')
      return
    }

    const safeWidth = normalizeDimension(targetWidth, DEFAULT_WIDTH)
    const safeHeight = normalizeDimension(targetHeight, DEFAULT_HEIGHT)
    const canvas = document.createElement('canvas')
    canvas.width = safeWidth
    canvas.height = safeHeight

    const context = canvas.getContext('2d')
    if (!context) {
      setError('Не удалось подготовить холст для снимка.')
      return
    }

    drawFrameToCanvas(video, context, safeWidth, safeHeight)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      setError('Не удалось сохранить снимок.')
      return
    }

    cleanupLastCaptureUrl()

    const timestamp = new Date().toISOString().replaceAll(':', '-')
    const url = URL.createObjectURL(blob)
    lastCaptureUrlRef.current = url

    setCaptureResult({
      url,
      width: safeWidth,
      height: safeHeight,
      timestamp,
    })

    downloadCapture(url, timestamp)
    setError('')
  }

  function handleClose() {
    stopCamera()
    onClose()
  }

  return (
    <section className="camera-card">
      <div className="camera-header">
        <div>
          <p className="eyebrow">Camera</p>
          <h1>Управление камерой</h1>
        </div>
        <button className="secondary-action" type="button" onClick={handleClose}>
          Закрыть
        </button>
      </div>

      <div className="camera-preview">
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          muted
          playsInline
        />
        {!isCameraReady && (
          <div className="camera-placeholder">
            {isStarting ? 'Подключаем камеру...' : 'Камера недоступна'}
          </div>
        )}
      </div>

      <div className="control-grid">
        <label className="field">
          <span>Ширина фото</span>
          <input
            type="number"
            inputMode="numeric"
            min="320"
            max="4096"
            step="1"
            value={targetWidth}
            onChange={(event) => setTargetWidth(Number(event.target.value))}
          />
        </label>

        <label className="field">
          <span>Высота фото</span>
          <input
            type="number"
            inputMode="numeric"
            min="320"
            max="4096"
            step="1"
            value={targetHeight}
            onChange={(event) => setTargetHeight(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="preset-row">
        <button
          className="chip"
          type="button"
          onClick={() => {
            setTargetWidth(1600)
            setTargetHeight(1200)
          }}
        >
          1600 x 1200
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setTargetWidth(1280)
            setTargetHeight(960)
          }}
        >
          1280 x 960
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setTargetWidth(1080)
            setTargetHeight(1080)
          }}
        >
          1080 x 1080
        </button>
      </div>

      <div className="action-row">
        <button
          className="secondary-action"
          type="button"
          onClick={handleTorchToggle}
          disabled={!torchSupported || !isCameraReady}
        >
          {torchEnabled ? 'Выключить вспышку' : 'Включить вспышку'}
        </button>

        <button
          className="primary-action"
          type="button"
          onClick={() => void handleCapture()}
          disabled={!isCameraReady}
        >
          Сделать фото и скачать
        </button>
      </div>

      <p className="helper-text">
        Снимок автоматически обрезается по центру под выбранный размер. Вспышка
        работает только на поддерживаемых мобильных устройствах и браузерах.
      </p>

      {error && <p className="status-message error">{error}</p>}

      {!torchSupported && isCameraReady && (
        <p className="status-message">
          В этом браузере или на этом устройстве управление вспышкой недоступно.
        </p>
      )}

      {captureResult && (
        <div className="capture-result">
          <div className="capture-meta">
            <strong>Последний снимок</strong>
            <span>
              {captureResult.width} x {captureResult.height}
            </span>
          </div>
          <img
            src={captureResult.url}
            alt="Последний сделанный снимок"
            className="capture-image"
          />
          <a
            className="download-link"
            href={captureResult.url}
            download={`camera-shot-${captureResult.timestamp}.jpg`}
          >
            Скачать еще раз
          </a>
        </div>
      )}
    </section>
  )
}

function normalizeDimension(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(4096, Math.max(320, Math.round(value)))
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
