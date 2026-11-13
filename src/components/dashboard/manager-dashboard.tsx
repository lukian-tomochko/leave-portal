import Link from "next/link";
import { CountUp } from "@/components/bento/count-up";
import { Gauge } from "@/components/bento/ring";
import { LegendRow, SplitBar } from "@/components/bento/split-bar";
import { Tile, TileHeader } from "@/components/bento/tile";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { dayLabel } from "@/lib/leave/calendar-view";
import { SCHOOL_MONTHS, schoolMonthIndex, type TeamOverview } from "@/lib/leave/dashboard";
import type { DecisionRecord } from "@/lib/leave/decision";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/messages";
import { LEAVE_TYPES, type LeaveType } from "@/lib/leave/types";
import { MonthlyChart } from "./monthly-chart";
import { TeamHeatmap } from "./team-heatmap";

const MIX_FILL: Record<LeaveType, string> = {
  sick: "bg-leave-sick",
  personal: "bg-leave-personal",
  unpaid: "bg-leave-unpaid",
  family: "bg-leave-family",
};

const HERO_OUTLINE = buttonVariants({
  variant: "outline",
  size: "lg",
  className: "border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background",
});

function waitText(awaitingTotal: number, oldestWaitDays: number | null): string {
  if (awaitingTotal === 0) {
    return "Черга порожня. Усе вирішено.";
  }
  return oldestWaitDays ? `Найстаріша заявка починається через ${oldestWaitDays} дн.` : "Є заявки на найближчі дні.";
}

function QueueHero({ awaitingTotal, oldestWaitDays, admin }: { awaitingTotal: number; oldestWaitDays: number | null; admin: boolean }) {
  return (
    <Tile hero index={0} className="col-span-5 flex min-h-52 flex-col justify-between">
      <span aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-44 animate-float rounded-full bg-primary opacity-90" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-28 bottom-6 size-16 animate-float rounded-full bg-leave-personal opacity-90"
        style={{ animationDuration: "9s", animationDelay: "-3s" }}
      />
      <div className="relative">
        <p className="text-xs text-background/70">Чекають на ваше рішення</p>
        <p className="mt-2 font-display text-7xl leading-none font-bold tracking-tight">
          <CountUp value={awaitingTotal} />
        </p>
        <p className="mt-3 text-sm text-background/70">{waitText(awaitingTotal, oldestWaitDays)}</p>
      </div>
      <div className="relative flex flex-wrap gap-3">
        <Link href="/decisions" className={buttonVariants({ size: "lg" })}>
          Рішення
        </Link>
        {admin ? (
          <Link href="/calendar/manage" className={HERO_OUTLINE}>
            Керувати закриттями
          </Link>
        ) : null}
      </div>
    </Tile>
  );
}

function OutTodayTile({ overview }: { overview: TeamOverview }) {
  const out = overview.outToday;
  return (
    <Tile index={1} className="col-span-3">
      <TileHeader title="Відсутні сьогодні" aside={`із ${overview.size}`} />
      <p className="font-display text-6xl leading-none font-bold tracking-tight">
        <CountUp value={out.length} />
      </p>
      <ul className="mt-4 flex flex-col gap-1 text-sm">
        {out.slice(0, 4).map((member) => (
          <li key={member.id} className="truncate">
            {member.name}
          </li>
        ))}
        {out.length > 4 ? <li className="text-muted-foreground">і ще {out.length - 4}</li> : null}
        {out.length === 0 ? <li className="text-muted-foreground">Усі на місці.</li> : null}
      </ul>
    </Tile>
  );
}

function CoverageTile({ overview }: { overview: TeamOverview }) {
  const risk = overview.riskDay;
  return (
    <Tile index={2} className="col-span-4">
      <TileHeader title="Покриття сьогодні" />
      <Gauge percent={overview.coveragePercent} label={`Покриття сьогодні: ${overview.coveragePercent}%`} className="stroke-leave-family" />
      <p className="-mt-9 text-center font-display text-3xl font-bold tracking-tight">
        <CountUp value={overview.coveragePercent} suffix="%" />
      </p>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        {risk ? `Найнижче в найближчі три тижні: ${risk.percent}%, ${dayLabel(risk.date)} (з урахуванням заявок, що чекають)` : "Найближчі три тижні без пропусків."}
      </p>
    </Tile>
  );
}

function QueueRow({ record }: { record: DecisionRecord }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-muted p-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
        {record.employeeName.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{record.employeeName}</p>
        <p className="text-xs text-muted-foreground">
          {LEAVE_TYPE_LABELS[record.leaveType]} · {dayLabel(record.date)}
        </p>
      </div>
      <StatusBadge status={record.status} />
      <Link href={`/records/${record.id}`} className={buttonVariants({ size: "sm" })}>
        Розглянути
      </Link>
    </li>
  );
}

function QueueTile({ queue }: { queue: DecisionRecord[] }) {
  return (
    <Tile index={5} className="col-span-7">
      <TileHeader
        title="На розгляд"
        aside={
          <Link href="/decisions" className="text-link underline-offset-4 hover:underline">
            Уся черга
          </Link>
        }
      />
      {queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records awaiting decision</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((record) => (
            <QueueRow key={record.id} record={record} />
          ))}
        </ul>
      )}
    </Tile>
  );
}

function MixTile({ overview }: { overview: TeamOverview }) {
  const total = LEAVE_TYPES.reduce((sum, type) => sum + overview.mix[type], 0);
  return (
    <Tile index={6} className="col-span-5">
      <TileHeader title="Розподіл за типами" aside={`${total} днів`} />
      {total > 0 ? (
        <SplitBar label="Розподіл днів за типами відпусток" parts={LEAVE_TYPES.map((type) => ({ key: type, value: overview.mix[type], className: MIX_FILL[type] }))} />
      ) : (
        <p className="my-3 text-sm text-muted-foreground">Записів ще немає.</p>
      )}
      <ul className="flex flex-col gap-1.5 text-sm">
        {LEAVE_TYPES.map((type) => (
          <LegendRow key={type} className={MIX_FILL[type]} label={LEAVE_TYPE_LABELS[type]} value={overview.mix[type]} />
        ))}
      </ul>
    </Tile>
  );
}

// Головна менеджера й адміністратора (bento): черга рішень, хто відсутній, покриття, теплова карта найближчих робочих днів,
// заявки за місяцями й розподіл за типами. Дані лише тих працівників, яких бачить користувач під RLS.
export function ManagerDashboard({
  today,
  role,
  overview,
  awaitingTotal,
  queue,
  oldestWaitDays,
}: {
  today: string;
  role: "manager" | "admin";
  overview: TeamOverview;
  awaitingTotal: number;
  queue: DecisionRecord[];
  oldestWaitDays: number | null;
}) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <QueueHero awaitingTotal={awaitingTotal} oldestWaitDays={oldestWaitDays} admin={role === "admin"} />
      <OutTodayTile overview={overview} />
      <CoverageTile overview={overview} />

      <Tile index={3} className="col-span-8">
        <TileHeader title="Хто відсутній · найближчі три тижні" aside={`працівників: ${overview.size}`} />
        {overview.size === 0 ? <p className="text-sm text-muted-foreground">Під вашим керуванням поки немає працівників.</p> : <TeamHeatmap overview={overview} today={today} />}
      </Tile>

      <Tile index={4} className="col-span-4">
        <TileHeader title="Дні відсутності за місяцями" aside="Approved і Awaiting" />
        <MonthlyChart labels={SCHOOL_MONTHS.slice(0, 6)} values={overview.monthly.slice(0, 6)} highlight={schoolMonthIndex(today)} unit="дн." />
      </Tile>

      <QueueTile queue={queue} />
      <MixTile overview={overview} />
    </div>
  );
}
