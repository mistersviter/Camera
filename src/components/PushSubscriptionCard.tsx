import { useEffect, useState } from 'react'
import {
  getPushSupportSnapshot,
  getServiceWorkerRegistration,
  sendTestPushNotification,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupportSnapshot,
} from '../lib/pwa'

export function PushSubscriptionCard() {
  const [support, setSupport] = useState<PushSupportSnapshot>(() =>
    getPushSupportSnapshot(),
  )
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSubscription() {
      const registration = await getServiceWorkerRegistration()
      const existingSubscription = await registration?.pushManager.getSubscription()

      if (!isMounted) {
        return
      }

      setSupport(getPushSupportSnapshot())
      setSubscription(existingSubscription?.toJSON() ?? null)
    }

    void loadSubscription()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubscribe() {
    setIsBusy(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const nextSubscription = await subscribeToPush()
      setSubscription(nextSubscription.toJSON())
      setStatusMessage(
        'Подписка создана. Следующим шагом бэкенд должен сохранить этот объект и отправлять push через него.',
      )
      setSupport(getPushSupportSnapshot())
    } catch (error) {
      setSupport(getPushSupportSnapshot())
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось подписаться на push-уведомления.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleUnsubscribe() {
    setIsBusy(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const unsubscribed = await unsubscribeFromPush()
      if (unsubscribed) {
        setSubscription(null)
        setStatusMessage('Подписка удалена с клиента.')
      } else {
        setStatusMessage('Активной подписки не было.')
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось удалить push-подписку.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleTestPush() {
    setIsBusy(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await sendTestPushNotification()
      setStatusMessage(
        'Тестовый payload отправлен в service worker. Если разрешение уже есть, уведомление должно появиться как обычный push.',
      )
      setSupport(getPushSupportSnapshot())
    } catch (error) {
      setSupport(getPushSupportSnapshot())
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось показать тестовое push-уведомление.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="push-card">
      <div className="push-card__header">
        <div>
          <p className="eyebrow">PWA</p>
          <h2>Push-уведомления</h2>
        </div>
        <span className="push-pill">
          {subscription ? 'Подписка активна' : 'Каркас готов'}
        </span>
      </div>

      <p className="description push-card__description">
        Service worker и клиентская подписка уже подключены. После добавления
        бэкенда это приложение сможет получать Web Push.
      </p>

      <div className="push-support-grid">
        <SupportItem label="Service Worker" value={support.serviceWorker} />
        <SupportItem label="Push API" value={support.pushManager} />
        <SupportItem label="Notifications" value={support.notifications} />
        <SupportItem label="Permission" value={support.permission} />
      </div>

      <div className="push-actions">
        <button
          className="primary-action"
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={isBusy || !support.canSubscribe}
        >
          {subscription ? 'Обновить подписку' : 'Подписаться на push'}
        </button>

        <button
          className="secondary-action"
          type="button"
          onClick={() => void handleUnsubscribe()}
          disabled={isBusy || !subscription}
        >
          Удалить подписку
        </button>

        <button
          className="secondary-action"
          type="button"
          onClick={() => void handleTestPush()}
          disabled={isBusy || !support.serviceWorker || !support.notifications}
        >
          Тестовое уведомление
        </button>
      </div>

      {!support.vapidKeyConfigured && (
        <p className="helper-text">
          Для реальной подписки нужен публичный VAPID-ключ в переменной
          `VITE_PUBLIC_VAPID_KEY`. Сейчас UI и логика готовы, но без ключа
          подписка не завершится.
        </p>
      )}

      {statusMessage && <p className="status-message">{statusMessage}</p>}
      {errorMessage && <p className="status-message error">{errorMessage}</p>}

      {subscription && (
        <details className="push-details">
          <summary>Показать объект подписки</summary>
          <pre>{JSON.stringify(subscription, null, 2)}</pre>
        </details>
      )}
    </section>
  )
}

function SupportItem({
  label,
  value,
}: {
  label: string
  value: boolean | NotificationPermission | 'unsupported'
}) {
  return (
    <div className="push-support-item">
      <span>{label}</span>
      <strong>{String(value)}</strong>
    </div>
  )
}
