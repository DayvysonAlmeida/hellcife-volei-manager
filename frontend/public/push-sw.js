/* Web Push do HellCife: importado pelo service worker do vite-plugin-pwa (workbox.importScripts). */

// Só caminhos do próprio app: o toque na notificação nunca leva para outro site
function appPath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

function windowClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    // Todo push precisa mostrar uma notificação: o navegador cancela a inscrição de quem não mostra
    await self.registration.showNotification(data.title || 'HellCife Vôlei', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png', // silhueta branca da barra de status do Android
      tag: data.id ? `notif-${data.id}` : undefined,
      data: { id: data.id, url: appPath(data.url) },
    });
    // Com o app aberto, a lista atualiza na hora, sem esperar a busca de 30s
    for (const client of await windowClients()) client.postMessage({ type: 'push' });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = appPath(event.notification.data && event.notification.data.url);

  event.waitUntil((async () => {
    const clients = await windowClients();
    const client = clients.find((c) => c.focused) || clients[0];
    if (client) {
      try {
        // App já aberto: traz para frente e navega sem recarregar
        await client.focus();
        client.postMessage({ type: 'open', url });
        return;
      } catch {
        // sem permissão para focar: abre uma janela nova
      }
    }
    await self.clients.openWindow(url);
  })());
});
