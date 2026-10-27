import { formatDays } from "@/lib/leave/balance";
import type { YearBalances } from "@/lib/leave/balance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Баланси за навчальний рік (AC-BALANCE-01): для «Sick leave» і «Personal leave» — надано, перенесено, використано, залишок;
// для «Unpaid leave» і «Family celebration» — лише використано (ліміту немає).
const days = (value: number) => formatDays(Math.round(value * 100));

export function BalanceView({ balances }: { balances: YearBalances }) {
  const limited = [
    { label: "Sick leave", balance: balances.sick, testId: "balance-sick" },
    { label: "Personal leave", balance: balances.personal, testId: "balance-personal" },
  ];
  const counted = [
    { label: "Unpaid leave", used: balances.unpaid.used, testId: "balance-unpaid" },
    { label: "Family celebration", used: balances.family.used, testId: "balance-family" },
  ];

  return (
    <section aria-labelledby="balance-title" className="flex flex-col gap-3">
      <h2 id="balance-title" className="text-lg font-semibold">
        Навчальний рік {balances.label}
      </h2>
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
    </section>
  );
}
