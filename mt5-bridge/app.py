import hmac
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import MetaTrader5 as mt5
from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

BRIDGE_SECRET = os.environ.get("MT5_GATEWAY_SECRET", "").strip()
TERMINAL_PATH = os.environ.get("MT5_TERMINAL_PATH", "").strip() or None
LOGIN_TIMEOUT_MS = int(os.environ.get("MT5_LOGIN_TIMEOUT_MS", "15000"))
DEFAULT_HISTORY_DAYS = 365

# One MT5 terminal holds one logged-in account at a time, so every broker call
# runs under this lock.
terminal_lock = threading.Lock()

app = FastAPI(title="Edge Log MT5 bridge")


class BridgeError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class Credentials(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    login: str = ""
    password: str = ""
    investorPassword: str = ""
    server: str = ""
    connectionId: Optional[str] = None
    accountId: Optional[str] = None
    userId: Optional[str] = None
    webhookUrl: Optional[str] = None
    webhookToken: Optional[str] = None
    platform: Optional[str] = None
    readOnly: Optional[bool] = None
    window_from: Optional[str] = Field(default=None, alias="from")
    window_to: Optional[str] = Field(default=None, alias="to")


@app.exception_handler(BridgeError)
async def bridge_error_handler(_: Request, error: BridgeError):
    return JSONResponse(
        status_code=error.status, content={"ok": False, "error": error.message}
    )


def require_secret(authorization: Optional[str]):
    if not BRIDGE_SECRET:
        raise BridgeError(503, "MT5_GATEWAY_SECRET is not set on the bridge.")
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    # A wrong bridge secret is a server misconfiguration, not a bad MT5 login,
    # so it must not use 401/403 (the app shows those as rejected credentials).
    if not token or not hmac.compare_digest(token, BRIDGE_SECRET):
        raise BridgeError(503, "Bridge secret does not match MT5_GATEWAY_SECRET.")


def connection_id(server: str, login: int) -> str:
    return f"{server}:{login}"


def ensure_terminal():
    initialized = (
        mt5.initialize(path=TERMINAL_PATH) if TERMINAL_PATH else mt5.initialize()
    )
    if not initialized:
        code, message = mt5.last_error()
        raise BridgeError(503, f"MT5 terminal is not available ({code}: {message}).")


def login_account(body: Credentials) -> int:
    login_text = body.login.strip()
    password = (body.investorPassword or body.password).strip()
    server = body.server.strip()
    if not login_text.isdigit() or not password or not server:
        raise BridgeError(400, "login, investorPassword, and server are required.")

    login = int(login_text)
    ensure_terminal()
    if not mt5.login(login, password=password, server=server, timeout=LOGIN_TIMEOUT_MS):
        code, message = mt5.last_error()
        # -6 is MT5's authorization failure; anything else is a terminal or
        # network problem the app should retry later.
        if code == -6:
            raise BridgeError(401, "MT5 rejected those credentials.")
        raise BridgeError(502, f"MT5 login failed ({code}: {message}).")
    return login


def account_money():
    info = mt5.account_info()
    if info is None:
        code, message = mt5.last_error()
        raise BridgeError(502, f"MT5 account info unavailable ({code}: {message}).")
    return float(info.balance), float(info.equity), info.currency


def parse_window(body: Credentials):
    def parse(value: Any) -> Optional[datetime]:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    end = parse(body.window_to) or datetime.now(timezone.utc)
    start = parse(body.window_from) or end - timedelta(days=DEFAULT_HISTORY_DAYS)
    return start, end


def iso_from_epoch(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()


# MT5 stamps deals and ticks with the broker's server clock (often UTC+2/+3)
# but reports them as if they were UTC. Measure that offset from a fresh tick,
# which uses the same clock as the deal stamps, and remember it per server so a
# closed market (weekend) can reuse the last good reading.
OFFSET_PROBE_SYMBOLS = ("EURUSD", "GBPUSD", "XAUUSD", "BTCUSD")
MAX_TICK_AGE_SECONDS = 300
server_offsets: dict[str, int] = {}


def server_utc_offset(server: str, symbols) -> int:
    now = time.time()
    for symbol in dict.fromkeys([*symbols, *OFFSET_PROBE_SYMBOLS]):
        if not mt5.symbol_select(symbol, True):
            continue
        tick = mt5.symbol_info_tick(symbol)
        if tick is None or not tick.time:
            continue
        drift = tick.time - now
        offset = round(drift / 1800) * 1800
        # A stale quote shows up as drift far from a whole half hour.
        if abs(offset) <= 14 * 3600 and abs(drift - offset) <= MAX_TICK_AGE_SECONDS:
            server_offsets[server] = offset
            return offset
    return server_offsets.get(server, 0)


def closed_deals(start: datetime, end: datetime, server: str):
    # Pad by a day: deal stamps run ahead of UTC by the server offset, so a
    # window ending at UTC "now" would drop the most recent closes.
    padded_start = start - timedelta(days=1)
    padded_end = end + timedelta(days=1)
    deals = mt5.history_deals_get(padded_start, padded_end)
    if deals is None:
        return []

    trade_types = (mt5.DEAL_TYPE_BUY, mt5.DEAL_TYPE_SELL)
    openings: dict[int, Any] = {}
    for deal in deals:
        if deal.type in trade_types and deal.entry == mt5.DEAL_ENTRY_IN:
            openings.setdefault(deal.position_id, deal)

    stops: dict[int, tuple[str, str]] = {}
    for order in mt5.history_orders_get(padded_start, padded_end) or []:
        stop_loss, take_profit = stops.get(order.position_id, ("", ""))
        stops[order.position_id] = (
            stop_loss or (str(order.sl) if order.sl else ""),
            take_profit or (str(order.tp) if order.tp else ""),
        )

    closing_entries = (
        mt5.DEAL_ENTRY_OUT,
        mt5.DEAL_ENTRY_INOUT,
        mt5.DEAL_ENTRY_OUT_BY,
    )
    closes = [
        deal
        for deal in deals
        if deal.type in trade_types and deal.entry in closing_entries
    ]
    offset = server_utc_offset(server, [deal.symbol for deal in closes]) if closes else 0

    rows = []
    for deal in closes:
        opening = openings.get(deal.position_id)
        # A closing SELL deal closes a long position, and vice versa.
        direction = "Long" if deal.type == mt5.DEAL_TYPE_SELL else "Short"
        stop_loss, take_profit = stops.get(deal.position_id, ("", ""))

        rows.append(
            {
                "positionId": str(deal.position_id),
                "ticket": str(deal.ticket),
                "symbol": deal.symbol,
                "direction": direction,
                "entry": "out",
                "openPrice": str(opening.price if opening else deal.price),
                "closePrice": str(deal.price),
                "sl": stop_loss,
                "tp": take_profit,
                "volume": str(deal.volume),
                "profit": float(deal.profit),
                "commission": float(deal.commission) + float(getattr(deal, "fee", 0.0)),
                "swap": float(deal.swap),
                "openTime": iso_from_epoch(opening.time - offset) if opening else None,
                "closeTime": iso_from_epoch(deal.time - offset),
            }
        )
    return rows


def snapshot(login: int, server: str, deals: Optional[list] = None):
    balance, equity, currency = account_money()
    body: dict[str, Any] = {
        "ok": True,
        "connectionId": connection_id(server, login),
        "login": str(login),
        "server": server,
        "currency": currency,
        "balance": balance,
        "equity": equity,
        "answer": {"Balance": balance, "Equity": equity},
    }
    if deals is not None:
        body["deals"] = deals
    return body


@app.get("/health")
def health():
    return {"ok": True, "service": "edge-log-mt5-bridge"}


@app.post("/v1/connections")
def create_connection(
    body: Credentials, authorization: Optional[str] = Header(default=None)
):
    require_secret(authorization)
    with terminal_lock:
        login = login_account(body)
        return snapshot(login, body.server.strip())


@app.post("/v1/history")
def history(body: Credentials, authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    start, end = parse_window(body)
    with terminal_lock:
        login = login_account(body)
        server = body.server.strip()
        return snapshot(login, server, closed_deals(start, end, server))


@app.delete("/v1/connections/{cid}")
def delete_connection(cid: str, authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    return {"ok": True, "connectionId": cid}
