import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildVideoConstraints,
  formatAspectRatio,
  formatResolution,
} from './cameraCaptureUtils'
import type {
  CameraStatus,
  TorchCapabilities,
  TorchConstraintSet,
} from './types'

export function useCameraSession() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [sourceResolution, setSourceResolution] = useState('')

  const applyStream = useCallback(async (stream: MediaStream) => {
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
      formatSourceResolution(
        trackSettings?.width ?? video?.videoWidth,
        trackSettings?.height ?? video?.videoHeight,
      ),
    )
    setStatus('ready')
  }, [])

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
    stopCamera()
    setStatus('starting')
    setError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(),
      })
      await applyStream(stream)
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
  }, [applyStream, stopCamera])

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
    let isCancelled = false

    async function initializeCamera() {
      setStatus('starting')
      setError('')

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildVideoConstraints(),
        })

        if (isCancelled) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
          return
        }

        await applyStream(stream)
      } catch (cameraError) {
        if (isCancelled) {
          return
        }

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
    }

    void initializeCamera()

    return () => {
      isCancelled = true
      stopCamera()
    }
  }, [applyStream, stopCamera])

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

function formatSourceResolution(width?: number, height?: number) {
  const resolution = formatResolution(width, height)
  const aspectRatio = formatAspectRatio(width, height)

  if (!resolution) {
    return ''
  }

  if (!aspectRatio) {
    return resolution
  }

  return `${resolution} • ${aspectRatio}`
}
