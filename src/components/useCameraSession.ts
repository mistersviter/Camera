import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildVideoConstraints,
  formatResolution,
} from './cameraCaptureUtils'
import type {
  CameraStatus,
  CaptureSettings,
  TorchCapabilities,
  TorchConstraintSet,
} from './types'

export function useCameraSession(settings: CaptureSettings) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [sourceResolution, setSourceResolution] = useState('')

  const stopCamera = useCallback(() => {
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
  }, [])

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
      if (!track) {
        setStatus('error')
        setError('Не удалось получить видеопоток камеры.')
        return
      }

      const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined
      const trackSettings = track.getSettings?.()

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

  const toggleTorch = useCallback(async () => {
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
  }, [torchEnabled, torchSupported])

  useEffect(() => {
    const startHandle = globalThis.setTimeout(() => {
      void startCamera()
    }, 0)

    return () => {
      globalThis.clearTimeout(startHandle)
      stopCamera()
    }
  }, [startCamera, stopCamera])

  return {
    error,
    sourceResolution,
    startCamera,
    status,
    stopCamera,
    torchEnabled,
    torchSupported,
    toggleTorch,
    videoRef,
  }
}
