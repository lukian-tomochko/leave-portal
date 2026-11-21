// Трекер помилок сервера без Sentry (WS11, трек B; ADR 0011): Next.js викликає onRequestError (src/instrumentation.ts) на кожну
// необроблену помилку сервера, а звідси йде КОРОТКЕ повідомлення в Telegram-групу команди: маршрут, метод, назва помилки, digest,
// до п'яти верхніх рядків стеку, деплой, середовище. Основа — ops-kit курсу (src/instrumentation.ts.example):
// https://github.com/koldovsky/2026-quitcode-11-devops-operations-hw/blob/main/materials/ops-kit/src/instrumentation.ts.example
//
// Що НЕ надсилаємо ніколи: заголовки запиту (там cookie сесії), тіло, рядок запиту (?query) і error.message (може містити дані
// користувача). Зі стеку беремо лише рядки «at …»; заголовок «Назва: текст помилки» відкидаємо цілим. Повний стек — у Runtime Logs
// Vercel (на Hobby вони живуть годину, тож дивіться одразу після повідомлення). Файл не читає process.env і не робить мережевих
// викликів сам, окрім sendTelegram: тому його можна тестувати без мережі.

const TIMEOUT_MS = 2_500; // не тримаємо відповідь користувачу довше: Telegram недоступний — повідомлення пропадає
export const SAME_ERROR_PAUSE_MS = 60_000; // та сама помилка на тому самому маршруті — не частіше разу на хвилину
const STACK_FRAMES = 5; // скільки верхніх рядків «at …» стеку надсилати
const lastSent = new Map<string, number>();

export type AlertRequest = { method: string };
export type AlertContext = { routePath: string; routeType: string; routerKind: string };
export type AlertEnv = Readonly<Record<string, string | undefined>>;

// Заголовок стеку («Назва: текст помилки») може бути багаторядковим і містити дані користувача: відрізаємо його цілим.
function stackBody(error: Error): string {
  const header = error.message ? `${error.name}: ${error.message}` : error.name;
  if (error.stack?.startsWith(header)) return error.stack.slice(header.length);
  return (error.stack ?? "").split("\n").slice(header.split("\n").length).join("\n"); // заголовок інший — пропускаємо стільки ж рядків
}

/**
 * Лише рядки «at … файл:рядок:колонка». Абсолютний шлях скорочуємо до .next/…, src/… чи node_modules/…: щоб у чат не потрапило
 * ім'я користувача ОС із локального шляху.
 */
export function stackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== "string") return [];
  return stackBody(error)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at ") && /:\d+:\d+\)?$/.test(line))
    .map((line) => line.replace(/(?:[A-Za-z]:)?[\\/][^\s()]*?[\\/](\.next|src|node_modules)[\\/]/g, "$1/"))
    .slice(0, STACK_FRAMES)
    .map((line) => line.slice(0, 160));
}

const digestOf = (error: unknown): string => {
  const raw = (error as { digest?: unknown } | null)?.digest;
  return typeof raw === "string" ? raw.slice(0, 40) : "";
};

/** Чи надсилати: та сама помилка на тому самому маршруті — не частіше разу на хвилину. now — для тестів. */
export function claimSlot(error: unknown, route: string, now: number = Date.now()): boolean {
  const key = `${route}|${digestOf(error) || (error instanceof Error ? error.name : typeof error)}`;
  if (now - (lastSent.get(key) ?? 0) < SAME_ERROR_PAUSE_MS) return false;
  lastSent.set(key, now);
  return true;
}

/** Текст повідомлення. APP_ENV=staging — змінна лише для гілки staging; без неї — VERCEL_ENV. */
export function alertText(error: unknown, request: AlertRequest, context: AlertContext, vars: AlertEnv): string {
  const name = error instanceof Error ? error.name : typeof error;
  const digest = digestOf(error);
  const env = vars.APP_ENV || vars.VERCEL_ENV || "local";
  const branch = vars.VERCEL_GIT_COMMIT_REF;
  const frames = stackFrames(error);
  return [
    "SERVER ERROR",
    `Environment: ${env}${branch ? ` (branch ${branch})` : ""}`,
    // routePath — шаблон маршруту (/requests/[id]) без id і без ?query.
    `Route: ${request.method} ${context.routePath} (${context.routeType}, ${context.routerKind})`,
    `Error: ${name}${digest ? `, digest ${digest}` : ""}`,
    `Deploy: ${vars.VERCEL_DEPLOYMENT_ID ?? "?"}, commit ${(vars.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}`,
    ...(frames.length ? ["Stack (top frames):", ...frames] : []),
  ].join("\n");
}

/** Один POST у Telegram. Помилку мережі навмисно не журналюємо: її текст містить адресу запиту, а в ній — токен бота. */
export async function sendTelegram(text: string, token: string, chatId: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Навмисно нічого не пишемо.
  }
}
