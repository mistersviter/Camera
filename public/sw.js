self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data)
  const title = payload.title || 'Camera'
  const options = {
    body: payload.body || 'Новое уведомление из приложения Camera.',
    icon: `${self.registration.scope}favicon.svg`,
    badge: `${self.registration.scope}favicon.svg`,
    data: {
      url: payload.url || self.registration.scope,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || self.registration.scope

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    }),
  )
})

function parsePushPayload(data) {
  if (!data) {
    return {}
  }

  try {
    return data.json()
  } catch {
    return { body: data.text() }
  }
}
