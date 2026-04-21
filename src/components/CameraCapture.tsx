import { useRef, useState } from 'react'
import { captureFromPreview, downloadCapture } from './cameraCaptureUtils'
import type { CameraStatus, CaptureResult, CaptureSettings } from './types'
import { useCameraSession } from './useCameraSession'
import './CameraCapture.css'

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
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const {
    error,
    sourceResolution,
    startCamera,
    status,
    stopCamera,
    torchEnabled,
    torchSupported,
    toggleTorch,
    videoRef,
  } = useCameraSession(settings)

  async function handleCapture() {
    const video = videoRef.current
    const viewport = viewportRef.current
    const frame = frameRef.current

    if (
      !video ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      !viewport ||
      !frame
    ) {
      return
    }

    setIsCapturing(true)

    try {
      const photoBlob = await captureFromPreview(video, viewport, frame, settings)

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
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <section className="camera-screen">
      <CameraTopbar
        onClose={onClose}
        sourceResolution={sourceResolution}
        status={status}
        torchEnabled={torchEnabled}
        torchSupported={torchSupported}
        onToggleTorch={() => void toggleTorch()}
      />

      <CameraViewport
        frameRef={frameRef}
        frameStyle={{ aspectRatio: `${settings.width} / ${settings.height}` }}
        onBack={onBack}
        onRetry={() => void startCamera()}
        status={status}
        error={error}
        videoRef={videoRef}
        viewportRef={viewportRef}
      />

      <CameraBottomBar
        error={status === 'ready' ? error : ''}
        isCapturing={isCapturing}
        isReady={status === 'ready'}
        onCapture={() => void handleCapture()}
      />
    </section>
  )
}

function CameraTopbar({
  onClose,
  onToggleTorch,
  sourceResolution,
  status,
  torchEnabled,
  torchSupported,
}: {
  onClose: () => void
  onToggleTorch: () => void
  sourceResolution: string
  status: CameraStatus
  torchEnabled: boolean
  torchSupported: boolean
}) {
  return (
    <div className="camera-screen__topbar">
      <div className="camera-screen__topbar-group">
        <button className="ghost-action" type="button" onClick={onClose}>
          Закрыть
        </button>

        {torchSupported && status === 'ready' && (
          <button
            className={`camera-toggle ${torchEnabled ? 'camera-toggle--active' : ''}`}
            type="button"
            onClick={onToggleTorch}
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
  )
}

function CameraViewport({
  error,
  frameRef,
  frameStyle,
  onBack,
  onRetry,
  status,
  videoRef,
  viewportRef,
}: {
  error: string
  frameRef: React.RefObject<HTMLDivElement | null>
  frameStyle: { aspectRatio: string }
  onBack: () => void
  onRetry: () => void
  status: CameraStatus
  videoRef: React.RefObject<HTMLVideoElement | null>
  viewportRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="camera-screen__viewport" ref={viewportRef}>
      <video ref={videoRef} className="camera-screen__video" autoPlay muted playsInline />

      {status === 'ready' && (
        <div className="camera-screen__overlay">
          <div className="camera-screen__frame" style={frameStyle} ref={frameRef}>
            <div className="camera-screen__grid" />
          </div>
        </div>
      )}

      {status !== 'ready' && (
        <CameraFallback status={status} error={error} onBack={onBack} onRetry={onRetry} />
      )}
    </div>
  )
}

function CameraFallback({
  error,
  onBack,
  onRetry,
  status,
}: {
  error: string
  onBack: () => void
  onRetry: () => void
  status: CameraStatus
}) {
  return (
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
          <button className="secondary-action" type="button" onClick={onRetry}>
            Повторить попытку
          </button>
        )}
        <button className="primary-action" type="button" onClick={onBack}>
          Вернуться к параметрам
        </button>
      </div>
    </div>
  )
}

function CameraBottomBar({
  error,
  isCapturing,
  isReady,
  onCapture,
}: {
  error: string
  isCapturing: boolean
  isReady: boolean
  onCapture: () => void
}) {
  return (
    <div className="camera-screen__bottomsheet">
      {error && <p className="status-message error">{error}</p>}

      <div className="camera-screen__capture-bar">
        <button
          className="capture-button"
          type="button"
          onClick={onCapture}
          disabled={!isReady || isCapturing}
          aria-label={isCapturing ? 'Сохраняем фото' : 'Сделать фото'}
        >
          <span className="capture-button__inner" />
        </button>
      </div>
    </div>
  )
}
