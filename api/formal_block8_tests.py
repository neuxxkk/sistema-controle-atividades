import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://localhost:8000"


def request_json(method: str, path: str, data: dict | None = None, expected_status: int | None = None):
    body = None
    headers = {"Content-Type": "application/json"}
    if data is not None:
        body = json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode())
            if expected_status is not None and resp.status != expected_status:
                raise AssertionError(f"{method} {path} expected {expected_status}, got {resp.status}")
            return resp.status, payload
    except urllib.error.HTTPError as error:
        raw = error.read().decode() if error.fp else ""
        try:
            payload = json.loads(raw) if raw else {"detail": raw}
        except Exception:
            payload = {"detail": raw}
        if expected_status is not None and error.code == expected_status:
            return error.code, payload
        raise AssertionError(f"{method} {path} failed with {error.code}: {payload}")


def test_name(prefix: str) -> str:
    return f"{prefix} {int(time.time())}"


if __name__ == "__main__":
    created_users: list[int] = []

    print("[1] Preparando usuarios base")
    _, usuarios = request_json("GET", "/api/usuarios/")
    admins = [u for u in usuarios if u.get("role") == "admin" and u.get("ativo")]
    if not admins:
        raise SystemExit("Nenhum admin ativo encontrado para executar testes formais.")
    admin = admins[0]

    # Garante bootstrap de vínculo admin quando necessário.
    status, admin_vinculo = request_json(
        "GET",
        f"/api/usuarios/{admin['id']}/vinculo-maquina?solicitante_id={admin['id']}",
        expected_status=200,
    )
    if status == 200 and not admin_vinculo.get("vinculo_maquina"):
        request_json(
            "PUT",
            f"/api/usuarios/{admin['id']}/vinculo-maquina",
            {
                "admin_id": admin["id"],
                "nome_dispositivo": "bootstrap-admin",
                "ip": "127.0.0.1",
                "windows_username": "admin.bootstrap",
            },
            expected_status=200,
        )
        print("  - Vínculo inicial de admin criado para bootstrap")

    _, funcionario_1 = request_json(
        "POST",
        "/api/usuarios/",
        {
            "nome": test_name("Funcionario Teste A"),
            "role": "funcionario",
            "ativo": True,
        },
        expected_status=200,
    )
    created_users.append(funcionario_1["id"])

    _, funcionario_2 = request_json(
        "POST",
        "/api/usuarios/",
        {
            "nome": test_name("Funcionario Teste B"),
            "role": "funcionario",
            "ativo": True,
        },
        expected_status=200,
    )
    created_users.append(funcionario_2["id"])

    print("[2] Teste primeiro acesso funcionario")
    payload_maquina_a = {
        "nome_completo": funcionario_1["nome"],
        "nome_dispositivo": "maquina-teste-a",
        "ip": "127.0.0.1",
        "windows_username": "func.a",
        "confirmar_maquina_anterior": False,
    }
    _, primeiro = request_json("POST", "/api/usuarios/primeiro-acesso", payload_maquina_a, expected_status=200)
    assert primeiro.get("primeiro_acesso") is True, "Primeiro acesso deveria retornar primeiro_acesso=True"

    print("[3] Teste auto login (reentrada na mesma maquina)")
    _, segundo = request_json("POST", "/api/usuarios/primeiro-acesso", payload_maquina_a, expected_status=200)
    assert segundo.get("primeiro_acesso") is False, "Reentrada deveria retornar primeiro_acesso=False"

    print("[4] Teste acesso negado em maquina diferente")
    payload_maquina_diferente = {
        "nome_completo": funcionario_1["nome"],
        "nome_dispositivo": "maquina-invasora",
        "ip": "127.0.0.2",
        "windows_username": "func.a.outro",
        "confirmar_maquina_anterior": False,
    }
    status, negado = request_json("POST", "/api/usuarios/primeiro-acesso", payload_maquina_diferente, expected_status=403)
    assert status == 403 and "Máquina não autorizada" in str(negado.get("detail")), "Esperado bloqueio por máquina diferente"

    print("[5] Teste alteracao de vinculo por admin")
    _, alterado_admin = request_json(
        "PUT",
        f"/api/usuarios/{funcionario_1['id']}/vinculo-maquina",
        {
            "admin_id": admin["id"],
            "nome_dispositivo": "maquina-admin-ajustada",
            "ip": "127.0.0.1",
            "windows_username": "func.a.admin",
        },
        expected_status=200,
    )
    vinculo_atual = alterado_admin.get("vinculo_maquina") or {}
    assert vinculo_atual.get("windows_username") == "func.a.admin", "Vínculo não refletiu alteração por admin"

    print("[6] Teste nao-admin nao altera vinculo")
    status, nao_admin = request_json(
        "PUT",
        f"/api/usuarios/{funcionario_1['id']}/vinculo-maquina",
        {
            "admin_id": funcionario_2["id"],
            "nome_dispositivo": "tentativa-nao-admin",
            "ip": "127.0.0.3",
            "windows_username": "sem.permissao",
        },
        expected_status=403,
    )
    assert status == 403 and "Apenas admin" in str(nao_admin.get("detail")), "Esperado bloqueio para não-admin"

    print("[7] Regressao API sessoes/dashboard/historico")
    request_json("GET", f"/api/sessoes/status-atual?usuario_id={funcionario_1['id']}", expected_status=200)
    request_json("GET", f"/api/sessoes/?usuario_id={funcionario_1['id']}", expected_status=200)
    request_json("GET", "/api/dashboard/progresso", expected_status=200)
    request_json("GET", "/api/dashboard/produtividade", expected_status=200)
    request_json("GET", "/api/dashboard/horas-trabalhadas", expected_status=200)

    _, atividades = request_json("GET", "/api/atividades/", expected_status=200)
    if atividades:
        atividade_id = atividades[0]["id"]
        request_json("GET", f"/api/atividades/{atividade_id}/historico", expected_status=200)

    print("[8] Limpeza de usuarios de teste")
    for uid in created_users:
        try:
            request_json("DELETE", f"/api/usuarios/{uid}", expected_status=200)
        except Exception as error:
            print(f"  - Aviso: falha ao remover usuário de teste {uid}: {error}")

    print("BLOCK8_API_TESTS_OK")
