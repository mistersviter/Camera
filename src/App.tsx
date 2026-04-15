import { useState } from 'react'
import { CameraCapture } from './components/CameraCapture'
import './App.css'

function App() {
  const [isCameraOpen, setIsCameraOpen] = useState(false)

  return (
    <main className="app-shell">
      {isCameraOpen ? (
        <CameraCapture onClose={() => setIsCameraOpen(false)} />
      ) : (
        <section className="hero-card">
          <p className="eyebrow">Camera</p>
          <h1>Быстрый доступ к камере</h1>
          <p className="description">
            Запускайте камеру по кнопке, управляйте вспышкой и сразу получайте
            готовый снимок нужного размера.
          </p>
          <button
            className="primary-action"
            type="button"
            onClick={() => setIsCameraOpen(true)}
          >
            Открыть камеру
          </button>
        </section>
      )}
    </main>
  )
}

export default App
