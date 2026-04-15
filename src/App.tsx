import { useEffect, useRef, useState } from 'react'
import { CameraCapture } from './components/CameraCapture'
import './App.css'

type AppStep = 'home' | 'setup' | 'camera'

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

const DEFAULT_SETTINGS: CaptureSettings = {
  width: 1600,
  height: 1200,
}

export default function App() {
  const [step, setStep] = useState<AppStep>('home')
  const [settings, setSettings] = useState<CaptureSettings>(DEFAULT_SETTINGS)
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

  function updateSetting(key: keyof CaptureSettings, value: number) {
    setSettings((current) => ({
      ...current,
      [key]: normalizeDimension(value, current[key]),
    }))
  }

  function applyPreset(width: number, height: number) {
    setSettings({ width, height })
  }

  if (step === 'camera') {
    return (
      <main className="app-shell">
        <CameraCapture
          settings={settings}
          onBack={() => setStep('setup')}
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

  if (step === 'home') {
    return (
      <main className="app-shell">
        <section className="setup-card hero-card">
          <p className="eyebrow">Camera</p>
          <h1>Быстрый доступ к съёмке</h1>
          <p className="description">
            Пользователь начинает с одной кнопки, затем выбирает параметры
            итогового кадра и снимает фото только через камеру.
          </p>
          <button className="primary-action" type="button" onClick={() => setStep('setup')}>
            Начать
          </button>
        </section>
      </main>
    )
  }

  const aspectRatio = settings.width / settings.height
  const previewStyle = { aspectRatio: `${settings.width} / ${settings.height}` }

  return (
    <main className="app-shell">
      <section className="setup-card">
        <div className="setup-header">
          <div>
            <p className="eyebrow">Camera</p>
            <h1>Параметры итогового фото</h1>
          </div>
          <button className="ghost-action" type="button" onClick={() => setStep('home')}>
            Назад
          </button>
        </div>

        <p className="description">
          Сначала задаём размер изображения, затем открываем полноэкранную
          камеру. Галерея не используется: пользователь может только снимать.
        </p>

        <div className="control-grid">
          <label className="field">
            <span>Ширина фото</span>
            <input
              type="number"
              inputMode="numeric"
              min="320"
              max="4096"
              step="1"
              value={settings.width}
              onChange={(event) => updateSetting('width', Number(event.target.value))}
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
              value={settings.height}
              onChange={(event) => updateSetting('height', Number(event.target.value))}
            />
          </label>
        </div>

        <div className="preset-row">
          <button className="chip" type="button" onClick={() => applyPreset(1600, 1200)}>
            1600 x 1200
          </button>
          <button className="chip" type="button" onClick={() => applyPreset(1280, 960)}>
            1280 x 960
          </button>
          <button className="chip" type="button" onClick={() => applyPreset(1080, 1080)}>
            1080 x 1080
          </button>
        </div>

        <section className="framing-card">
          <div className="framing-header">
            <strong>Итоговый кадр</strong>
            <span>
              {settings.width} x {settings.height}
            </span>
          </div>
          <div className="framing-preview">
            <div className="framing-safe-zone" style={previewStyle}>
              <div className="framing-grid" />
            </div>
          </div>
          <p className="helper-text">
            Эта рамка показывает реальное соотношение сторон итогового
            изображения. В самой камере вы увидите такую же область кадра.
          </p>
          <p className="helper-text">
            Соотношение сторон: {aspectRatio.toFixed(2)}. Размер после обработки
            будет строго {settings.width} x {settings.height}.
          </p>
        </section>

        <button className="primary-action setup-action" type="button" onClick={() => setStep('camera')}>
          Открыть камеру
        </button>

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

function normalizeDimension(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(4096, Math.max(320, Math.round(value)))
}
