const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY ?? ''

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null
let pendingUpdateRegistration: ServiceWorkerRegistration | null = null

export type PushSupportSnapshot = {
  serviceWorker: boolean
  pushManager: boolean
  notifications: boolean
  canSubscribe: boolean
  permission: NotificationPermission | 'unsupported'
  vapidKeyConfigured: boolean
  isIos: boolean
  isStandalone: boolean
}

type ServiceWorkerUpdateListener = () => void

const serviceWorkerUpdateListeners = new Set<ServiceWorkerUpdateListener>()

export function getPushSupportSnapshot(): PushSupportSnapshot {
  const userAgent = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
  const isStandalone =
    'standalone' in navigator
      ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      : globalThis.matchMedia?.('(display-mode: standalone)').matches ?? false
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
    isIos,
    isStandalone,
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
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then((registration) => {
        bindServiceWorkerUpdateTracking(registration)

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          globalThis.location.reload()
        })

        return registration
      })
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

export async function sendTestPushNotification() {
  const registration = await ensureNotificationReady()
  const activeWorker = registration.active

  if (!activeWorker) {
    throw new Error('Активный service worker пока недоступен. Обновите страницу и попробуйте снова.')
  }

  activeWorker.postMessage({
    type: 'SHOW_TEST_PUSH',
    payload: {
      title: 'Camera',
      body: 'Это тестовое уведомление, отправленное через service worker.',
      url: `${globalThis.location.origin}${import.meta.env.BASE_URL}`,
    },
  })
}

export async function scheduleTestPushNotification(delayMs = 10000) {
  const registration = await ensureNotificationReady()

  globalThis.setTimeout(() => {
    registration.active?.postMessage({
      type: 'SHOW_TEST_PUSH',
      payload: {
        title: 'Camera',
        body: 'Тестовое уведомление по таймеру. Проверьте экран блокировки.',
        url: `${globalThis.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
  }, delayMs)
}

export function hasPendingServiceWorkerUpdate() {
  return Boolean(pendingUpdateRegistration?.waiting)
}

export function subscribeToServiceWorkerUpdates(listener: ServiceWorkerUpdateListener) {
  serviceWorkerUpdateListeners.add(listener)
  return () => {
    serviceWorkerUpdateListeners.delete(listener)
  }
}

export async function applyServiceWorkerUpdate() {
  const registration = pendingUpdateRegistration ?? (await getServiceWorkerRegistration())
  if (!registration?.waiting) {
    throw new Error('Новой версии service worker сейчас нет.')
  }

  registration.waiting.postMessage({ type: 'SKIP_WAITING' })
}

async function ensureNotificationReady() {
  const support = getPushSupportSnapshot()
  if (!support.serviceWorker || !support.notifications) {
    throw new Error('Этот браузер не поддерживает service worker или уведомления.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Пользователь не разрешил уведомления.')
  }

  const registration = await getServiceWorkerRegistration()
  if (!registration?.active) {
    throw new Error(
      'Активный service worker пока недоступен. Обновите страницу и попробуйте снова.',
    )
  }

  return registration
}

function bindServiceWorkerUpdateTracking(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    pendingUpdateRegistration = registration
    notifyServiceWorkerUpdateListeners()
  }

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing
    if (!installingWorker) {
      return
    }

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
        pendingUpdateRegistration = registration
        notifyServiceWorkerUpdateListeners()
      }
    })
  })
}

function notifyServiceWorkerUpdateListeners() {
  for (const listener of serviceWorkerUpdateListeners) {
    listener()
  }
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
