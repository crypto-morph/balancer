import { AlertsList } from "@/components/alerts-list";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { PortfolioTable } from "@/components/portfolio-table";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Balancer Dashboard</h1>
          <div className="text-sm text-zinc-500">Prototype</div>
        </header>
        <Separator />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Indicators</div>
            <div className="text-sm text-zinc-500">BTCD / DXY / Fear & Greed (coming soon)</div>
          </Card>
          <Card className="p-4 md:col-span-2">
            <div className="text-sm font-medium mb-2">Portfolio</div>
            <PortfolioTable />
          </Card>
        </section>

        <section>
          <div className="text-sm font-medium mb-2">Alerts</div>
          <AlertsList />
        </section>
      </main>
    </div>
  );
}
