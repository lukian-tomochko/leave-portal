import { formatDays } from "@/lib/leave/balance";
import type { YearBalances } from "@/lib/leave/balance";
import { Ring } from "@/components/bento/ring";
import { Tile } from "@/components/bento/tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Баланси за навчальний рік (AC-BALANCE-01): для «Sick leave» і «Personal leave» — надано, перенесено, використано, залишок;
// для «Unpaid leave» і «Family celebration» — лише використано (ліміту немає).
const days = (value: number) => formatDays(Math.round(value * 100));

export function BalanceView({ balances }: { balances: YearBalances }) {
  const limited = [
    { label: "Sick leave", balance: balances.sick, testId: "balance-sick", ring: "stroke-leave-sick" },
    { label: "Personal leave", balance: balances.personal, testId: "balance-personal", ring: "stroke-leave-personal" },
  ];
  const counted = [
    { label: "Unpaid leave", used: balances.unpaid.used, testId: "balance-unpaid" },
    { label: "Family celebration", used: balances.family.used, testId: "balance-family" },
  ];

  // Частка залишку від наданого з перенесеним: суто візуальна підказка, точні числа — у таблиці.
  const percentLeft = (balance: { granted: number; carriedOver: number; remaining: number }) => {
    const total = balance.granted + balance.carriedOver;
    return total > 0 ? Math.round((balance.remaining / total) * 100) : 0;
  };

  return (
    <section aria-labelledby="balance-title" className="flex flex-col gap-4">
      <h2 id="balance-title" className="px-1 font-display text-xl font-bold tracking-tight">
        Навчальний рік {balances.label}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {limited.map(({ label, balance, ring }, index) => {
          const percent = percentLeft(balance);
          return (
            <Tile key={label} index={index} className="flex items-center gap-4">
              <Ring percent={percent} label={`${label}: залишок ${percent}%`} className={ring} />
              <div>
<p className="text-sm text-muted-foreground">{label}</p>
<p className="font-display text-3xl font-bold tabular-nums" aria-hidden="true">{percent}%</p>
</div>
            </Tile>
          );
        })}
      </div>
      <Tile index={2} className="p-2">
      <Table data-testid="balances">
        <TableHeader>
          <TableRow>
            <TableHead>Leave type</TableHead>
            <TableHead>Granted</TableHead>
            <TableHead>Carried over</TableHead>
            <TableHead>Used</TableHead>
            <TableHead>Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {limited.map(({ label, balance, testId }) => (
            <TableRow key={label} data-testid={testId}>
              <TableCell>{label}</TableCell>
              <TableCell className="tabular-nums">{days(balance.granted)}</TableCell>
              <TableCell className="tabular-nums">{days(balance.carriedOver)}</TableCell>
              <TableCell className="tabular-nums">{days(balance.used)}</TableCell>
              <TableCell className="tabular-nums">{days(balance.remaining)}</TableCell>
            </TableRow>
          ))}
          {counted.map(({ label, used, testId }) => (
            <TableRow key={label} data-testid={testId}>
              <TableCell>{label}</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="tabular-nums">{days(used)}</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </Tile>
    </section>
  );
}
