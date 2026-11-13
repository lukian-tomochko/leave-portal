import { CalendarPlusIcon, ClockIcon, WavesIcon } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/bento/count-up";
import { Ring } from "@/components/bento/ring";
import { LegendRow, SplitBar } from "@/components/bento/split-bar";
import { Tile, TileHeader } from "@/components/bento/tile";
import { MonthGrid } from "@/components/calendar/month-grid";
import { StatusBadge, STATUS_FILL } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import type { YearBalances } from "@/lib/leave/balance";
import { buildDayMap, dayLabel } from "@/lib/leave/calendar-view";
import { type Closure, closureOn, describeClosure } from "@/lib/leave/closures";
import { groupAbsences, monthlyCounts, nextAbsence, schoolMonthIndex, SCHOOL_MONTHS, statusCounts } from "@/lib/leave/dashboard";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { RECORD_STATUSES, type LeaveRecordView } from "@/lib/leave/types";
import { MonthlyChart } from "./monthly-chart";

const range = (from: string, to: string) => (from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`);

// Головна працівника (bento): наступна відсутність, баланси кільцями, статуси заявок, місяць, використані дні й найближче
// закриття школи. Усе з даних, які працівник і так бачить на «Мої заявки», «Баланс» і «Календар».
export function EmployeeDashboard({
  today,
  records,
  balances,
  closures,
}: {
  today: string;
  records: LeaveRecordView[];
  balances: YearBalances;
  closures: Closure[];
}) {
  const dated = records.map((record) => ({ date: record.date, status: record.status, leaveType: record.leaveType }));
  const next = nextAbsence(groupAbsences(dated), today);
  const counts = statusCounts(records);
  const month = today.slice(0, 7);
  const upcomingClosure = [...closures].sort((a, b) => a.startsOn.localeCompare(b.startsOn)).find((closure) => closure.endsOn >= today && closure.closedFrom === null);
  const approvedDays = [...new Set(records.filter((record) => record.status === "approved").map((record) => record.date))];
  const used = monthlyCounts(approvedDays, balances.year);
  const dayMap = buildDayMap({ month, closures, mine: dated });
  const latest = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const totalRecords = records.length;
  const todayClosure = closureOn(closures, today);

  const limited = [
    { key: "sick", title: "Sick leave", balance: balances.sick, ring: "stroke-leave-sick" },
    { key: "personal", title: "Personal leave", balance: balances.personal, ring: "stroke-leave-personal" },
  ] as const;

  return (
    <div className="grid grid-cols-12 gap-4">
      <Tile hero index={0} className="col-span-8 flex min-h-52 flex-col justify-between">
        <span aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-48 animate-float rounded-full bg-primary opacity-90" />
        <span aria-hidden="true" className="pointer-events-none absolute top-28 right-36 size-20 animate-float rounded-full bg-leave-personal opacity-90" style={{ animationDuration: "9s", animationDelay: "-3s" }} />
        <span aria-hidden="true" className="pointer-events-none absolute top-44 right-16 size-8 animate-float rounded-full bg-leave-family opacity-90" style={{ animationDuration: "5s" }} />
        <div className="relative max-w-[70%]">
          <p className="text-xs text-background/70">Найближча відпустка</p>
          {next ? (
            <>
              <p className="mt-2 font-display text-3xl leading-tight font-bold tracking-tight">
                {LEAVE_TYPE_LABELS[next.leaveType]}, {range(next.from, next.to)}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-background/70">
                <StatusBadge status={next.status} />
                {next.daysUntil === 0 ? "починається сьогодні" : `починається через ${next.daysUntil} дн.`}
              </p>
            </>
          ) : (
            <p className="mt-2 font-display text-3xl leading-tight font-bold tracking-tight">Відсутностей поки не заплановано</p>
          )}
        </div>
        <div className="relative flex flex-wrap gap-3">
          <Link href="/leave/new" className={buttonVariants({ size: "lg" })}>
            <CalendarPlusIcon aria-hidden="true" />
            Подати заявку
          </Link>
          <Link href="/leave" className={buttonVariants({ variant: "outline", size: "lg", className: "border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background" })}>
            Усі мої заявки
          </Link>
        </div>
      </Tile>

      <Tile index={1} className="col-span-4">
        <TileHeader title="Awaiting decision" aside={<ClockIcon aria-hidden="true" className="size-4" />} />
        <p className="font-display text-6xl leading-none font-bold tracking-tight">
          <CountUp value={counts.awaiting_decision} />
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {counts.awaiting_decision > 0 ? "Менеджер ще не вирішив. Поки так, заявку можна змінити чи скасувати." : "Усі ваші заявки опрацьовано."}
        </p>
      </Tile>

      {limited.map(({ key, title, balance, ring }, index) => (
        <Tile key={key} index={2 + index} className="col-span-4">
          <TileHeader title={title} aside={`із ${(balance.granted + balance.carriedOver).toFixed(0)} днів`} />
          <div className="flex items-center gap-4">
            <Ring percent={(balance.remaining / Math.max(balance.granted + balance.carriedOver, 1)) * 100} label={`${title}: залишилось ${balance.remaining.toFixed(2)} дня`} className={ring} />
            <div>
              <p className="font-display text-3xl leading-none font-bold tracking-tight">
                <CountUp value={balance.remaining} decimals={2} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">днів залишилось</p>
              <p className="text-xs text-muted-foreground">
                використано {balance.used.toFixed(2)}
                {balance.carriedOver > 0 ? `, перенесено ${balance.carriedOver.toFixed(2)}` : ""}
              </p>
            </div>
          </div>
          {balance.remaining < 3 ? (
            <p className="mt-3 rounded-xl bg-warning px-3 py-2 text-xs text-warning-foreground">Лишилось мало. Понад ліміт дні рахуються як Unpaid leave.</p>
          ) : null}
        </Tile>
      ))}

      <Tile index={4} className="col-span-4">
        <TileHeader title="Заявки за статусами" aside={`${totalRecords} записів`} />
        {totalRecords > 0 ? (
          <SplitBar label="Частка записів за статусами" parts={RECORD_STATUSES.map((status) => ({ key: status, value: counts[status], className: STATUS_FILL[status] }))} />
        ) : (
          <p className="my-3 text-sm text-muted-foreground">Заявок ще немає.</p>
        )}
        <ul className="flex flex-col gap-1.5 text-sm">
          {RECORD_STATUSES.map((status) => (
            <LegendRow key={status} className={STATUS_FILL[status]} label={STATUS_LABELS[status]} value={counts[status]} />
          ))}
        </ul>
      </Tile>

      <Tile index={5} className="col-span-5">
        <TileHeader
          title={`Цей місяць`}
          aside={
            <Link href="/calendar" aria-label="Усі дні" className="text-link underline-offset-4 hover:underline">
              Усі дні
            </Link>
          }
        />
        <MonthGrid month={month} today={today} days={dayMap} interactive={false} compact />
        {todayClosure ? <p className="mt-3 text-xs text-muted-foreground">Сьогодні: {todayClosure.name}</p> : null}
      </Tile>

      <Tile index={6} className="col-span-4">
        <TileHeader title="Використано днів за місяцями" aside="Approved" />
        <MonthlyChart labels={SCHOOL_MONTHS.slice(0, 6)} values={used.slice(0, 6)} highlight={schoolMonthIndex(today)} unit="дн." />
        <p className="mt-2 text-xs text-muted-foreground">Перші шість місяців навчального року: вересень – лютий.</p>
      </Tile>

      <Tile index={7} className="col-span-3">
        <TileHeader title="Наступне закриття" aside={<WavesIcon aria-hidden="true" className="size-4" />} />
        {upcomingClosure ? (
          <>
            <p className="font-display text-xl leading-tight font-bold tracking-tight">{upcomingClosure.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">{describeClosure(upcomingClosure)}</p>
            <p className="mt-3 text-xs text-muted-foreground">Школа закрита, відпустку подавати не потрібно.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Закриттів до кінця навчального року немає.</p>
        )}
      </Tile>

      <Tile index={8} className="col-span-12">
        <TileHeader
          title="Останні записи"
          aside={
            <Link href="/leave" className="text-link underline-offset-4 hover:underline">
              Усі заявки
            </Link>
          }
        />
        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">Заявок ще немає.</p>
        ) : (
          <ul className="flex flex-col">
            {latest.map((record) => (
              <li key={record.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{LEAVE_TYPE_LABELS[record.leaveType]}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {record.date}, {record.startsAt}–{record.endsAt}
                  </p>
                </div>
                <StatusBadge status={record.status} />
                <Link href={`/records/${record.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Деталі
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </div>
  );
}
