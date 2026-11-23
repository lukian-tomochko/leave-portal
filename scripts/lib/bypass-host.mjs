// Кому можна надсилати секрет обходу захисту Vercel (x-vercel-protection-bypass).
// Адреса приходить ззовні (client_payload.url чи ручний inputs.url), тож без перевірки секрет міг би піти на чужий сервер.
// Довіряємо лише: https і (точний хост проду з PROD_URL, або хост із суфіксом команди Vercel, напр. "-<team>.vercel.app").
// Суфікс не секретний: це slug команди в адресах preview. Залишковий ризик: проєкт з такою назвою в іншій команді —
// малоймовірний, а запустити smoke із чужою адресою може лише той, хто має write-доступ до репо.

/** Хост адреси в нижньому регістрі, лише для https; інакше порожній рядок (облікові дані user:pass@ у хост не входять). */
export function httpsHost(url) {
  try {
    const parsed = new URL(String(url ?? "").trim());
    return parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

/** true — секрет обходу можна надсилати на `base`. */
export function bypassHostAllowed(base, prodUrl, suffix = "") {
  const host = httpsHost(base);
  if (!host) return false;
  if (host === httpsHost(prodUrl)) return true;
  const allowed = String(suffix ?? "").trim().toLowerCase();
  return allowed.length > 1 && allowed.startsWith("-") && host.endsWith(allowed) && host.length > allowed.length;
}
