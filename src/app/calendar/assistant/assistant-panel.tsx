"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { listItemCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { describeClosure } from "@/lib/leave/closures";
import { ASSISTANT_PREPARING, ASSISTANT_TEXT_LIMIT } from "@/lib/leave/messages";
import { requestSuggestions, saveSuggestions } from "./actions";
import type { AssistantState, RowResult, SaveState, SuggestionRow } from "./state";

const IDLE_ASSISTANT: AssistantState = { status: "idle" };
const IDLE_SAVE: SaveState = { status: "idle" };

// Помічник календаря: текст → пропозиції (нічого не збережено) → редагування й «Save closures». Поки модель не відповіла,
// кнопка вимкнена й видно «Preparing suggestions…» (AC-ASSIST-08).
export function AssistantPanel() {
  const [state, formAction, pending] = useActionState(requestSuggestions, IDLE_ASSISTANT);
  const [length, setLength] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-3" data-testid="assistant-form">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calendar-text">School calendar text</Label>
          {/* Без maxLength: довший текст відхиляє дія з повідомленням (AC-ASSIST-10), а не браузер мовчки. */}
          <Textarea
            id="calendar-text"
            name="text"
            rows={6}
            required
            onChange={(event) => setLength([...event.target.value].length)}
            aria-describedby="calendar-text-count"
          />
          <p id="calendar-text-count" className="text-xs text-muted-foreground tabular-nums">
            {length} / {ASSISTANT_TEXT_LIMIT}
          </p>
        </div>
        {pending ? (
          <p role="status" className="text-sm text-muted-foreground" data-testid="assistant-preparing">
            {ASSISTANT_PREPARING}
          </p>
        ) : null}
        {state.status === "message" ? (
          <Alert variant={state.kind === "needs_info" ? "warning" : "destructive"} data-testid="assistant-message">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <div>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? <Spinner /> : null}
            Suggest closures
          </Button>
        </div>
      </form>

      {state.status === "suggested" ? <SuggestionsEditor key={state.requestId} initial={state.rows} /> : null}
    </div>
  );
}

function SuggestionsEditor({ initial }: { initial: SuggestionRow[] }) {
  const [rows, setRows] = useState(initial);
  const [saveState, saveAction, saving] = useActionState(saveSuggestions, IDLE_SAVE);

  const results = new Map<string, RowResult>(saveState.status === "done" ? saveState.results.map((r) => [r.key, r]) : []);
  // Збережені рядки більше не редагуємо й не надсилаємо вдруге; відхилені лишаються з повідомленням вимоги 04.
  const pendingRows = rows.filter((row) => results.get(row.key)?.ok !== true);
  const savedRows = rows.filter((row) => results.get(row.key)?.ok === true);

  const update = (key: string, patch: Partial<SuggestionRow>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <section aria-labelledby="suggestions-title" className="flex flex-col gap-3" data-testid="assistant-suggestions">
      <h2 id="suggestions-title" className="text-sm font-semibold">
        Suggested closures
      </h2>
      <p className="text-sm text-muted-foreground">Nothing is saved yet. Review, correct or remove suggestions, then save.</p>

      {saveState.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{saveState.message}</AlertDescription>
        </Alert>
      ) : null}

      {savedRows.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm" data-testid="assistant-saved">
          {savedRows.map((row) => (
            <li key={row.key} className={`flex flex-wrap items-center justify-between gap-2 p-3 ${listItemCard}`}>
              <span className="font-medium">{row.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {describeClosure({ name: row.name, startsOn: row.startsOn, endsOn: row.kind === "early" ? row.startsOn : row.endsOn, closedFrom: row.kind === "early" ? row.time : null })}
              </span>
              <span className="text-xs font-semibold text-link">Saved</span>
            </li>
          ))}
        </ul>
      ) : null}

      {pendingRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suggestions left.</p>
      ) : (
        <form action={saveAction} className="flex flex-col gap-3">
          <input type="hidden" name="rows" value={JSON.stringify(pendingRows)} />
          <ul className="flex flex-col gap-3" data-testid="assistant-rows">
            {pendingRows.map((row) => {
              const result = results.get(row.key);
              return (
                <li key={row.key} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
                  {/* Текстовий підсумок рядка: що саме буде збережено (значення полів нижче не читаються як текст сторінки). */}
                  <p className="text-sm font-medium tabular-nums" data-testid="suggestion-summary">
                    {row.name}:{" "}
                    {row.kind === "early" ? `early dismissal on ${row.startsOn} from ${row.time}` : `whole days ${describeClosure({ name: row.name, startsOn: row.startsOn, endsOn: row.endsOn, closedFrom: null })}`}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`name-${row.key}`}>Name</Label>
                      <Input id={`name-${row.key}`} value={row.name} onChange={(event) => update(row.key, { name: event.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`kind-${row.key}`}>Type</Label>
                      <NativeSelect
                        id={`kind-${row.key}`}
                        value={row.kind}
                        onChange={(event) => update(row.key, { kind: event.target.value as SuggestionRow["kind"], time: event.target.value === "early" ? row.time || "12:00" : "" })}
                      >
                        <option value="whole">Whole days</option>
                        <option value="early">Early dismissal</option>
                      </NativeSelect>
                    </div>
                  </div>
                  {row.kind === "whole" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`start-${row.key}`}>Start date</Label>
                        <Input id={`start-${row.key}`} type="date" value={row.startsOn} onChange={(event) => update(row.key, { startsOn: event.target.value })} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`end-${row.key}`}>End date</Label>
                        <Input id={`end-${row.key}`} type="date" value={row.endsOn} onChange={(event) => update(row.key, { endsOn: event.target.value })} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`date-${row.key}`}>Date</Label>
                        <Input
                          id={`date-${row.key}`}
                          type="date"
                          value={row.startsOn}
                          onChange={(event) => update(row.key, { startsOn: event.target.value, endsOn: event.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`time-${row.key}`}>School closes at</Label>
                        <Input id={`time-${row.key}`} type="time" step={300} value={row.time} onChange={(event) => update(row.key, { time: event.target.value })} />
                      </div>
                    </div>
                  )}
                  {result && !result.ok ? (
                    <Alert variant="destructive">
                      <AlertDescription>{result.message}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              {saving ? <Spinner /> : null}
              Save closures
            </Button>
          </div>
        </form>
      )}

      {saveState.status === "done" ? (
        <Link href="/calendar" className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
          School calendar
        </Link>
      ) : null}
    </section>
  );
}
