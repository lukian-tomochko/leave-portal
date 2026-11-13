import { CalendarDaysIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginBackdrop } from "@/components/login-backdrop";
import { SubmitButton } from "@/components/submit-button";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Вкажіть email і пароль.",
  invalid: "Невірний email або пароль.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <>
      <LoginBackdrop />
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex animate-bloom flex-col items-center gap-3 text-center">
        <span className="grid size-16 animate-wobble place-items-center rounded-3xl bg-primary text-primary-foreground shadow-tile">
          <CalendarDaysIcon aria-hidden="true" className="size-8" />
        </span>
        <p className="font-display text-3xl font-bold tracking-tight">Портал відпусток</p>
      </div>
      <Card className="w-full animate-bloom shadow-tile" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold">Вхід</CardTitle>
          <CardDescription>Увійдіть, щоб подати заявку на відпустку або ухвалити рішення.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {message ? (
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            <SubmitButton size="lg">Увійти</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
    </>
  );
}
