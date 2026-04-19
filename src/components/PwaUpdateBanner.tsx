import { useEffect, useState } from 'react'
import {
  applyServiceWorkerUpdate,
  hasPendingServiceWorkerUpdate,
  subscribeToServiceWorkerUpdates,
} from '../lib/pwa'

export function PwaUpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(() => hasPendingServiceWorkerUpdate())
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    return subscribeToServiceWorkerUpdates(() => {
      setHasUpdate(hasPendingServiceWorkerUpdate())
    })
  }, [])

  if (!hasUpdate) {
    return null
  }

  async function handleUpdate() {
    setIsUpdating(true)
    setErrorMessage('')

    try {
      await applyServiceWorkerUpdate()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось применить обновление приложения.',
      )
      setIsUpdating(false)
    }
  }

  return (
    <section className="update-banner">
      <div className="update-banner__content">
        <strong>Доступно обновление приложения</strong>
        <p>Новая версия уже загружена. Нажмите кнопку, чтобы переключиться на нее.</p>
      </div>
      <button
        className="primary-action"
        type="button"
        onClick={() => void handleUpdate()}
        disabled={isUpdating}
      >
        {isUpdating ? 'Обновляем...' : 'Обновить приложение'}
      </button>
      {errorMessage && <p className="status-message error">{errorMessage}</p>}
    </section>
  )
}
