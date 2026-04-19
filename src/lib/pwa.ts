const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY ?? ''

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null

export type PushSupportSnapshot = {
  serviceWorker: boolean
  pushManager: boolean
  notifications: boolean
  canSubscribe: boolean
  permission: NotificationPermission | 'unsupported'
  vapidKeyConfigured: boolean
}

export function getPushSupportSnapshot(): PushSupportSnapshot {
  const serviceWorker = 'serviceWorker' in navigator
  const pushManager = 'PushManager' in globalThis
  const notifications = 'Notification' in globalThis
  const permission = notifications ? Notification.permission : 'unsupported'
  const vapidKeyConfigured = Boolean(VAPID_PUBLIC_KEY)

  return {
    serviceWorker,
    pushManager,
    notifications,
    permission,
    vapidKeyConfigured,
    canSubscribe:
      serviceWorker && pushManager && notifications && permission !== 'denied',
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    serviceWorkerRegistrationPromise = Promise.resolve(null)
    return serviceWorkerRegistrationPromise
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL },
    )
  }

  return serviceWorkerRegistrationPromise
}

export async function getServiceWorkerRegistration() {
  return registerServiceWorker()
}

export async function subscribeToPush() {
  const support = getPushSupportSnapshot()
  if (!support.serviceWorker || !support.pushManager || !support.notifications) {
    throw new Error('Этот браузер не поддерживает Web Push.')
  }

  if (!support.vapidKeyConfigured) {
    throw new Error(
      'Не задан VAPID-ключ. Добавьте VITE_PUBLIC_VAPID_KEY в окружение приложения.',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Пользователь не разрешил уведомления.')
  }

  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    throw new Error('Service worker не зарегистрирован.')
  }

  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    return existingSubscription
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
}

export async function unsubscribeFromPush() {
  const registration = await getServiceWorkerRegistration()
  const existingSubscription = await registration?.pushManager.getSubscription()

  if (!existingSubscription) {
    return false
  }

  return existingSubscription.unsubscribe()
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const normalizedBase64 = (base64String + padding)
    .replaceAll('-', '+')
    .replaceAll('_', '/')
  const rawData = atob(normalizedBase64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}
