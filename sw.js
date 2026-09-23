/* عامل خدمة بسيط — قشرة التطبيق فقط.
   - التنقّل: الشبكة أولاً، وعند انقطاعها تُعرض القشرة المخزَّنة.
   - أصول البناء (/assets/*) والأيقونات: من الخزنة ثم تُحدَّث في الخلفية.
   - أي طلب لأصل آخر (Supabase، الخطوط) لا يُلمس ولا يُخزَّن: لا بيانات شركة في الخزنة. */
const CACHE = 'acs-team-shell-v2'
// الموقع قد يعيش تحت مسار فرعي (GitHub Pages): كل المسارات نسبةً إلى مكان هذا الملف.
const BASE = new URL('./', self.location).pathname
const SHELL = [BASE, BASE + 'manifest.webmanifest', BASE + 'favicon.svg', BASE + 'icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // خزنات هذا الموقع القديمة فقط: على github.io الأصل مشترك مع مواقع أخرى للحساب نفسه.
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('acs-team-shell-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // صفحات GitHub تردّ 404.html (بحالة 404) للمسارات العميقة: لا نخزّن إلا الردّ السليم.
          // ولا نخزّن إلا HTML، حتى لا يحلّ ملف فُتح مباشرةً (أيقونة مثلاً) محلّ القشرة.
          if (res.ok && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(BASE, copy))
          }
          return res
        })
        .catch(() => caches.match(BASE).then((hit) => hit || Response.error())),
    )
    return
  }

  const isStatic =
    url.pathname.startsWith(BASE + 'assets/') || SHELL.includes(url.pathname) || url.pathname.startsWith(BASE + 'icon-')
  if (!isStatic) return

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit || Response.error())
        return hit || refresh
      }),
    ),
  )
})
