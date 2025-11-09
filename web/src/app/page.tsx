import { AlertsList } from "@/components/alerts-list";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { PortfolioTable } from "@/components/portfolio-table";
import { IndicatorsCard } from "@/components/indicators-card";
import { SummaryCard } from "@/components/summary-card";
import { PortfolioPie } from "@/components/portfolio-pie";
import { HealthBadge } from "@/components/health-badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-7xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Balancer Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-zinc-500">Prototype</div>
            <HealthBadge />
          </div>
        </header>
        <Separator />

        <section className="grid grid-cols-1 gap-6">
          <SummaryCard />
        </section>

        <section className="grid grid-cols-1 gap-6">
          <IndicatorsCard />
        </section>

        <section className="grid grid-cols-1 gap-6">
          <PortfolioPie />
        </section>

        <section className="grid grid-cols-1 gap-6">
          <PortfolioTable />
        </section>

        <section>
          <div className="text-sm font-medium mb-2">Alerts</div>
          <AlertsList />
        </section>
      </main>
    </div>
  );
}
