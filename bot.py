import time
import os
import sys
import datetime
from collections import defaultdict
import requests
import MetaTrader5 as mt5

SUPABASE_URL = "https://nuvoeaqorlzrrhscosim.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dm9lYXFvcmx6cnJoc2Nvc2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTk1NTU2NywiZXhwIjoyMDk3NTMxNTY3fQ.dNxaUeXs_RjlD-HlezKA0MMlc3Z7jkdbRhdDrlDMV08"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

MT5_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"

def get_participants():
    url = f"{SUPABASE_URL}/rest/v1/tournament_participants?select=*"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[Supabase] Error consultando participantes: {e}")
    return []

def update_participant(pid, data):
    url = f"{SUPABASE_URL}/rest/v1/tournament_participants?id=eq.{pid}"
    try:
        requests.patch(url, headers=HEADERS, json=data, timeout=8)
    except Exception as e:
        print(f"[Supabase] Error actualizando participante {pid}: {e}")

def ensure_mt5():
    """Verifica conexion con MT5. Si no esta abierto, lo abre con su ruta exacta SIN matar nada."""
    try:
        term = mt5.terminal_info()
        if term is not None:
            return True
    except:
        pass

    try:
        mt5.shutdown()
    except:
        pass
    time.sleep(1)

    try:
        if mt5.initialize(path=MT5_PATH, timeout=30000):
            print("[INFO] MetaTrader 5 conectado correctamente.")
            return True
    except:
        pass

    # Si el proceso no estaba abierto, iniciarlo suavemente
    try:
        print("[INFO] Abriendo MetaTrader 5 en el servidor...")
        os.startfile(MT5_PATH)
        time.sleep(10)
        if mt5.initialize(path=MT5_PATH, timeout=30000):
            print("[INFO] MetaTrader 5 abierto y conectado con exito.")
            return True
    except Exception as ex:
        print(f"[ERROR] No se pudo lanzar MT5: {ex}")

    return False

def calculate_rules(deals, initial_balance):
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")
    
    start_of_week = now_utc - datetime.timedelta(days=now_utc.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_month = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 1. Agrupar salidas por position_id (Parciales = 1 trade unico)
    positions = defaultdict(list)
    for deal in deals:
        pos_id = getattr(deal, 'position_id', None) or deal.ticket
        positions[pos_id].append(deal)

    sorted_positions = sorted(
        positions.items(),
        key=lambda item: min((getattr(d, 'time', 0) for d in item[1]), default=0)
    )

    total_pnl = 0.0
    daily_pnl = 0.0
    weekly_pnl = 0.0
    monthly_pnl = 0.0

    daily_trades = {}
    daily_losses = {}
    win_count = 0
    loss_count = 0
    be_count = 0
    violations = 0

    peak_balance = initial_balance
    current_equity_sim = initial_balance
    max_drawdown_amount = 0.0

    for pos_id, p_deals in sorted_positions:
        pos_profit = sum(float(d.profit or 0.0) + float(getattr(d, 'commission', 0.0)) + float(getattr(d, 'swap', 0.0)) for d in p_deals)
        total_pnl += pos_profit
        current_equity_sim += pos_profit

        if current_equity_sim > peak_balance:
            peak_balance = current_equity_sim
        drawdown = peak_balance - current_equity_sim
        if drawdown > max_drawdown_amount:
            max_drawdown_amount = drawdown

        if pos_profit > 0.50:
            win_count += 1
        elif pos_profit < -0.50:
            loss_count += 1
        else:
            be_count += 1

        first_deal_time = min((getattr(d, 'time', 0) for d in p_deals if getattr(d, 'time', 0)), default=None)
        if first_deal_time:
            dt = datetime.datetime.fromtimestamp(first_deal_time, tz=datetime.timezone.utc)
            d_str = dt.strftime("%Y-%m-%d")
            daily_trades[d_str] = daily_trades.get(d_str, 0) + 1

            if pos_profit < 0:
                daily_losses[d_str] = daily_losses.get(d_str, 0.0) + abs(pos_profit)

            if d_str == today_str:
                daily_pnl += pos_profit
            if dt >= start_of_week:
                weekly_pnl += pos_profit
            if dt >= start_of_month:
                monthly_pnl += pos_profit

    for d_str, count in daily_trades.items():
        if count > 1:
            violations += (count - 1)

    today_loss = daily_losses.get(today_str, 0.0)
    today_dd_pct = (today_loss / initial_balance * 100.0) if initial_balance > 0 else 0.0
    if today_dd_pct > 1.1:
        violations += 1

    dd_max_pct = (max_drawdown_amount / initial_balance * 100.0) if initial_balance > 0 else 0.0
    is_disqualified = dd_max_pct >= 5.0

    status = "Descalificado: Max DD >= 5%" if is_disqualified else "Activo"

    trades_count = len(sorted_positions)
    win_rate = round((win_count / trades_count * 100.0), 2) if trades_count > 0 else 0.0
    return_pct = round((total_pnl / initial_balance * 100.0), 2) if initial_balance > 0 else 0.0
    pnl_daily_pct = round((daily_pnl / initial_balance * 100.0), 2) if initial_balance > 0 else 0.0
    pnl_weekly_pct = round((weekly_pnl / initial_balance * 100.0), 2) if initial_balance > 0 else 0.0
    pnl_monthly_pct = round((monthly_pnl / initial_balance * 100.0), 2) if initial_balance > 0 else 0.0

    discipline_score = max(0.0, 100.0 - (violations * 10.0))

    return {
        "status": status,
        "net_pnl": round(total_pnl, 2),
        "return_pct": return_pct,
        "pnl_daily_pct": pnl_daily_pct,
        "pnl_weekly_pct": pnl_weekly_pct,
        "pnl_monthly_pct": pnl_monthly_pct,
        "dd_daily_pct": round(today_dd_pct, 2),
        "dd_max_pct": round(dd_max_pct, 2),
        "discipline_score": round(discipline_score, 2),
        "win_rate": win_rate,
        "current_score": return_pct,
        "trades_count": trades_count,
        "win_count": win_count,
        "loss_count": loss_count,
        "be_count": be_count,
        "violations_count": violations
    }

def run_synchronizer():
    print("=" * 60)
    print("SYNTRACKER FX - SINCRONIZADOR WETRADE MT5 (ROBUSTO 24/7)")
    print("=" * 60)

    # Conectar suavemente sin matar nada
    if not ensure_mt5():
        print("[WARN] No se pudo inicializar MT5 al arranque. Reintentando...")
        time.sleep(5)
        if not ensure_mt5():
            print("[ERROR] MetaTrader 5 debe estar instalado en C:\\Program Files\\MetaTrader 5\\terminal64.exe")
            return

    ciclo = 1
    while True:
        try:
            participants = get_participants()
            hora = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"\n[{hora} | Ciclo #{ciclo}] Sincronizando {len(participants)} cuentas...")

            for idx, p in enumerate(participants, 1):
                pid = p['id']
                name = p.get('user_name') or p.get('full_name') or 'Participante'
                login_raw = str(p.get('mt5_login', '')).strip()
                pwd = str(p.get('mt5_password', '')).strip()
                server = str(p.get('mt5_server', '')).strip() or "WeTrade-MT5"

                if not login_raw.isdigit() or len(login_raw) not in [7, 8]:
                    continue

                login = int(login_raw)

                # Si MT5 se cayó por alguna razon, reabrirlo sin taskkill
                if not ensure_mt5():
                    print(f"[{idx}/{len(participants)}] [WARN] Esperando reconexion de MT5...")
                    time.sleep(5)
                    continue

                authorized = False
                try:
                    authorized = mt5.login(login=login, password=pwd, server=server, timeout=12000)
                except Exception as ex:
                    authorized = False

                if not authorized:
                    err = mt5.last_error()
                    # Si falla, simplemente saltar la cuenta sin matar el programa
                    # Nunca ejecutar taskkill por una cuenta individual
                    print(f"[{idx}/{len(participants)}] [SALTAR] #{login} ({name}) no conecto: {err}")
                    time.sleep(2)
                    continue

                acc = mt5.account_info()
                if acc is None:
                    time.sleep(2)
                    continue

                current_balance = float(acc.balance)
                initial_balance = float(p.get('initial_balance') or current_balance or 10000.0)
                if initial_balance <= 0:
                    initial_balance = current_balance

                from_date = datetime.datetime(2026, 9, 1)
                to_date = datetime.datetime.now()
                deals = mt5.history_deals_get(from_date, to_date)
                closed_deals = [d for d in deals if d.entry == mt5.DEAL_ENTRY_OUT] if deals else []

                metrics = calculate_rules(closed_deals, initial_balance)
                metrics["current_balance"] = current_balance
                metrics["initial_balance"] = initial_balance

                update_participant(pid, metrics)
                print(f"[{idx}/{len(participants)}] [OK] #{login} ({name}) -> Bal: ${current_balance:,.2f} | PnL: ${metrics['net_pnl']:+,.2f} | Trades: {metrics['trades_count']} | Faltas: {metrics['violations_count']}")

                # Pausa prudente de 2 segundos entre cuentas
                time.sleep(2)

            print(f"\n⏳ Ciclo #{ciclo} completado con exito. Pausa de 60 segundos antes de la siguiente vuelta...")
            ciclo += 1
            time.sleep(60)

        except Exception as main_err:
            print(f"[ERROR] Excepcion inesperada en ciclo: {main_err}")
            time.sleep(15)

if __name__ == "__main__":
    run_synchronizer()
