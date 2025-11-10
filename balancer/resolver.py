from __future__ import annotations
from typing import Dict, Any, List
from dataclasses import dataclass, asdict

from .db import SessionLocal
from .models import Asset, Position
from .clients import CoingeckoClient


@dataclass
class Proposal:
    symbol: str
    name: str
    current_coingecko_id: str | None
    candidates: List[Dict[str, Any]]


def _pick_candidates(resp: Dict[str, Any], want_symbol: str, want_name: str) -> List[Dict[str, Any]]:
    coins = resp.get("coins") or []
    out: List[Dict[str, Any]] = []
    want_symbol_l = (want_symbol or "").lower()
    want_name_l = (want_name or "").lower()
    for c in coins:
        # c fields: id, name, api_symbol, symbol, market_cap_rank, thumb, large
        out.append(
            {
                "id": c.get("id"),
                "symbol": c.get("symbol"),
                "name": c.get("name"),
                "api_symbol": c.get("api_symbol"),
                "market_cap_rank": c.get("market_cap_rank"),
                "score": c.get("score"),
            }
        )
    # Prefer exact symbol match to top
    out.sort(
        key=lambda c: (
            0 if (c.get("symbol") or "").lower() == want_symbol_l else 1,
            0 if (c.get("name") or "").lower() == want_name_l else 1,
            c.get("market_cap_rank") or 1_000_000,
        )
    )
    # Keep top few
    return out[:5]


def resolve_missing_coingecko_ids(limit: int = 100) -> Dict[str, Any]:
    """Return proposals for assets (with positions) missing coingecko_id.
    Does NOT mutate DB. Intended for human approval.
    """
    client = CoingeckoClient()
    proposals: List[Proposal] = []
    with SessionLocal() as db:
        rows: List[Asset] = (
            db.query(Asset)
            .join(Position, Position.asset_id == Asset.id)
            .filter(Asset.coingecko_id.is_(None), Asset.active == True)
            .distinct()
            .limit(limit)
            .all()
        )
        for a in rows:
            q = a.symbol or a.name or ""
            if not q:
                continue
            try:
                resp = client.search(q)
            except Exception:
                resp = {"coins": []}
            candidates = _pick_candidates(resp, a.symbol or "", a.name or "")
            proposals.append(
                Proposal(
                    symbol=a.symbol,
                    name=a.name,
                    current_coingecko_id=a.coingecko_id,
                    candidates=candidates,
                )
            )
    return {
        "count": len(proposals),
        "proposals": [asdict(p) for p in proposals],
    }
