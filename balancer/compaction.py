from __future__ import annotations
from datetime import datetime, timedelta
from .db import engine


def _ensure_indexes() -> None:
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_prices_asset_ccy_at ON prices(asset_id, ccy, at)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_fx_ccy_at ON fx_rates(base_ccy, quote_ccy, at)")


def _delete_not_in(conn, table: str, where: str, group_expr: str) -> None:
    # Keep the latest row per group_expr; delete the rest within 'where' scope
    # Emulate QUALIFY using grouped MAX(at)
    sql = f"""
    DELETE FROM {table}
    WHERE {where}
      AND (asset_id, ccy, at) NOT IN (
        SELECT asset_id, ccy, MAX(at) AS at
        FROM {table}
        WHERE {where}
        GROUP BY {group_expr}
      )
    """
    conn.exec_driver_sql(sql)


def compact_prices(now: datetime | None = None) -> None:
    """Retain: hourly for 24h, daily for 365d, monthly for older."""
    _ensure_indexes()
    now = now or datetime.utcnow()
    with engine.begin() as conn:
        # Hourly window: last 24 hours
        since_24h = now - timedelta(hours=24)
        where_hour = f"at >= '{since_24h.isoformat(sep=' ')}'"
        grp_hour = "asset_id, ccy, strftime('%Y-%m-%d %H:00:00', at)"
        _delete_not_in(conn, "prices", where_hour, grp_hour)

        # Daily window: last 365 days
        since_1y = now - timedelta(days=365)
        where_day = f"at >= '{since_1y.isoformat(sep=' ')}'"
        grp_day = "asset_id, ccy, date(at)"
        _delete_not_in(conn, "prices", where_day, grp_day)

        # Monthly window: older than 365d
        where_month = f"at < '{since_1y.isoformat(sep=' ')}'"
        grp_month = "asset_id, ccy, strftime('%Y-%m-01', at)"
        _delete_not_in(conn, "prices", where_month, grp_month)


def compact_fx(now: datetime | None = None) -> None:
    _ensure_indexes()
    now = now or datetime.utcnow()
    with engine.begin() as conn:
        since_24h = now - timedelta(hours=24)
        since_1y = now - timedelta(days=365)
        # Hourly 24h
        where_hour = f"at >= '{since_24h.isoformat(sep=' ')}'"
        conn.exec_driver_sql(
            f"""
            DELETE FROM fx_rates
            WHERE {where_hour}
              AND (base_ccy, quote_ccy, at) NOT IN (
                SELECT base_ccy, quote_ccy, MAX(at) AS at
                FROM fx_rates
                WHERE {where_hour}
                GROUP BY base_ccy, quote_ccy, strftime('%Y-%m-%d %H:00:00', at)
              )
            """
        )
        # Daily 1y
        where_day = f"at >= '{since_1y.isoformat(sep=' ')}'"
        conn.exec_driver_sql(
            f"""
            DELETE FROM fx_rates
            WHERE {where_day}
              AND (base_ccy, quote_ccy, at) NOT IN (
                SELECT base_ccy, quote_ccy, MAX(at) AS at
                FROM fx_rates
                WHERE {where_day}
                GROUP BY base_ccy, quote_ccy, date(at)
              )
            """
        )
        # Monthly older
        where_month = f"at < '{since_1y.isoformat(sep=' ')}'"
        conn.exec_driver_sql(
            f"""
            DELETE FROM fx_rates
            WHERE {where_month}
              AND (base_ccy, quote_ccy, at) NOT IN (
                SELECT base_ccy, quote_ccy, MAX(at) AS at
                FROM fx_rates
                WHERE {where_month}
                GROUP BY base_ccy, quote_ccy, strftime('%Y-%m-01', at)
              )
            """
        )


def compact_all(now: datetime | None = None) -> None:
    compact_prices(now)
    compact_fx(now)
