import {
  BACKSTOP_ADDRESS,
  BACKSTOP_POOL_ADDRESS,
  explorerAddress,
} from "@/lib/config";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const contracts = [
  { name: "Backstop", address: BACKSTOP_ADDRESS },
  { name: "BackstopPool", address: BACKSTOP_POOL_ADDRESS },
];

export function ContractLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployed contracts (Coston2, verified)</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {contracts.map((c) => (
          <div
            key={c.address}
            className="flex flex-col gap-1 border-b border-ink-line/60 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-mono text-sm text-mist-100">{c.name}</span>
            <a
              href={explorerAddress(c.address)}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs text-guard-400 underline underline-offset-2"
            >
              {c.address} ↗
            </a>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
