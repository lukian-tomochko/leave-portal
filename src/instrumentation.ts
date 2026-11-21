import type { Instrumentation } from "next";
import { alertText, claimSlot, sendTelegram } from "@/lib/error-alert";

// Трекер помилок сервера (WS11, трек B; ADR 0011): Next.js викликає onRequestError на кожну необроблену помилку сервера
// (сторінка, маршрут API, Server Action, proxy). Логіка й правила приватності — у src/lib/error-alert.ts.
// TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID — змінні середовища Vercel (Production і Preview), без NEXT_PUBLIC_; GitHub Secrets сюди
// не потрапляють. Немає змінних — функція мовчки нічого не робить.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || !claimSlot(error, context.routePath)) return;
  await sendTelegram(alertText(error, request, context, process.env), token, chatId);
};
