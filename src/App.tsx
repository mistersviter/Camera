import { useEffect, useRef, useState } from 'react'
import { CameraCapture } from './components/CameraCapture'
import { PushSubscriptionCard } from './components/PushSubscriptionCard'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import { CAMERA_OUTPUT_SETTINGS, CAMERA_REQUEST_RESOLUTION } from './config/camera'
import type { CaptureResult } from './components/types'
import './App.css'

type AppStep = 'home' | 'camera'

export default function App() {
  const [step, setStep] = useState<AppStep>('home')
  const [result, setResult] = useState<CaptureResult | null>(null)
  const lastCaptureUrlRef = useRef<string | null>(null)

  const cleanupLastCaptureUrl = () => {
    if (lastCaptureUrlRef.current) {
      URL.revokeObjectURL(lastCaptureUrlRef.current)
      lastCaptureUrlRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      cleanupLastCaptureUrl()
    }
  }, [])

  if (step === 'camera') {
    return (
      <main className="app-shell">
        <CameraCapture
          settings={CAMERA_OUTPUT_SETTINGS}
          onBack={() => setStep('home')}
          onClose={() => setStep('home')}
          onCapture={(nextResult) => {
            cleanupLastCaptureUrl()
            lastCaptureUrlRef.current = nextResult.url
            setResult(nextResult)
          }}
        />
      </main>
    )
  }

  const previewStyle = getPreviewFrameStyle(CAMERA_OUTPUT_SETTINGS)

  return (
    <main className="app-shell">
      <section className="setup-card">
        <PwaUpdateBanner />

        <div className="setup-header">
          <div>
            <p className="eyebrow">Camera</p>
            <h1>Съемка с фиксированными параметрами</h1>
          </div>
        </div>

        <p className="description">
          Приложение теперь работает с заранее заданной конфигурацией. Камера
          запрашивается в высоком разрешении, а итоговый файл сохраняется в
          едином формате.
        </p>

        <section className="framing-card">
          <div className="framing-header">
            <strong>Конфигурация съемки</strong>
            <span>
              {CAMERA_OUTPUT_SETTINGS.width} x {CAMERA_OUTPUT_SETTINGS.height}
            </span>
          </div>
          <div className="framing-preview">
            <div className="framing-safe-zone" style={previewStyle}>
              <div className="framing-grid" />
            </div>
          </div>
          <p className="helper-text">
            Запрашиваемое разрешение камеры: {CAMERA_REQUEST_RESOLUTION.width} x{' '}
            {CAMERA_REQUEST_RESOLUTION.height}.
          </p>
          <p className="helper-text">
            Итоговый файл после обработки: {CAMERA_OUTPUT_SETTINGS.width} x{' '}
            {CAMERA_OUTPUT_SETTINGS.height}.
          </p>
        </section>

        <button className="primary-action setup-action" type="button" onClick={() => setStep('camera')}>
          Открыть камеру
        </button>

        <PushSubscriptionCard />

        {result && (
          <section className="capture-result">
            <div className="capture-meta">
              <strong>Последний снимок</strong>
              <span>
                {result.width} x {result.height}
              </span>
            </div>
            <img
              src={result.url}
              alt="Последний сделанный снимок"
              className="capture-image"
            />
            <a
              className="download-link"
              href={result.url}
              download={`camera-shot-${result.timestamp}.jpg`}
            >
              Скачать еще раз
            </a>
          </section>
        )}
      </section>
    </main>
  )
}

function getPreviewFrameStyle(settings: { width: number; height: number }) {
  const boxSize = 180
  const ratio = settings.width / settings.height

  if (ratio >= 1) {
    return {
      width: `${boxSize}px`,
      height: `${Math.round(boxSize / ratio)}px`,
    }
  }

  return {
    width: `${Math.round(boxSize * ratio)}px`,
    height: `${boxSize}px`,
  }
}
