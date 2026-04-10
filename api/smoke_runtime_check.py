import asyncio
import json
import urllib.request

BASE = "http://localhost:8000"
WS = "ws://localhost:8000/api/dashboard/ws/tempo-real"


def get_json(path: str):
    with urllib.request.urlopen(BASE + path, timeout=10) as response:
        return response.status, json.loads(response.read().decode())


def run_http_checks() -> bool:
    paths = [
        "/",
        "/api/dashboard/progresso",
        "/api/dashboard/produtividade",
        "/api/dashboard/horas-trabalhadas",
    ]
    all_ok = True
    for path in paths:
        try:
            status, payload = get_json(path)
            ok = status == 200 and isinstance(payload, (dict, list))
            print(f"HTTP {path} status={status} shape_ok={ok}")
            all_ok = all_ok and ok
        except Exception as error:
            print(f"HTTP {path} ERROR {error}")
            all_ok = False
    return all_ok


async def run_ws_check() -> tuple[bool, str]:
    try:
        import websockets
    except Exception as error:
        return False, f"websockets import error: {error}"

    try:
        async with websockets.connect(WS, open_timeout=10, close_timeout=5) as ws:
            message = await asyncio.wait_for(ws.recv(), timeout=10)
            payload = json.loads(message)
            ok = (
                isinstance(payload, dict)
                and payload.get("tipo") == "sessoes_ativas"
                and isinstance(payload.get("dados"), list)
            )
            info = f"tipo={payload.get('tipo')} dados_len={len(payload.get('dados', [])) if isinstance(payload.get('dados'), list) else 'n/a'}"
            return ok, info
    except Exception as error:
        return False, str(error)


if __name__ == "__main__":
    http_ok = run_http_checks()
    ws_ok, ws_info = asyncio.run(run_ws_check())
    print(f"WS ok={ws_ok} info={ws_info}")

    if not http_ok:
        raise SystemExit(2)
    if not ws_ok:
        raise SystemExit(3)

    print("SMOKE_RUNTIME_OK")
