from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_esi_client
from app.esi import EsiError
from app.main import app
from app.routers import eve as eve_router
from app.system_catalog import SystemCatalog, choose_route_flag


class FakeEsiClient:
    async def resolve_names(self, names: list[str]) -> dict:
        assert names == ["Jita", "Amarr"]
        return {
            "systems": [
                {"id": 30000142, "name": "Jita"},
                {"id": 30002187, "name": "Amarr"},
            ]
        }

    async def names(self, ids: list[int]) -> list[dict]:
        assert ids == [30000142]
        return [{"category": "solar_system", "id": 30000142, "name": "Jita"}]

    async def route(self, origin_id: int, destination_id: int, flag: str) -> list[int]:
        assert origin_id == 30000142
        assert destination_id == 30002187
        assert flag == "secure"
        return [30000142, 30000144, 30002187]

    async def status(self) -> dict:
        return {
            "players": 22144,
            "server_version": "2938421",
            "start_time": "2026-04-25T11:00:00Z",
            "vip": False,
        }

    async def system_jumps(self) -> list[dict]:
        return [
            {"system_id": 30000142, "ship_jumps": 101},
            {"system_id": 30000144, "ship_jumps": 7},
            {"system_id": 30002187, "ship_jumps": 55},
        ]


async def override_esi_client():
    yield FakeEsiClient()


@pytest.fixture(autouse=True)
def client_override():
    eve_router._system_jumps_cache = None
    eve_router._system_jumps_cache_expires_at = datetime.min.replace(tzinfo=UTC)
    app.dependency_overrides[get_esi_client] = override_esi_client
    yield
    app.dependency_overrides.clear()


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "solane-run-api"}


def test_resolve_names() -> None:
    with TestClient(app) as client:
        response = client.post("/api/eve/resolve-names", json={"names": ["Jita", "Amarr"]})

    assert response.status_code == 200
    assert response.json()["systems"][0]["name"] == "Jita"


def test_names() -> None:
    with TestClient(app) as client:
        response = client.post("/api/eve/names", json={"ids": [30000142]})

    assert response.status_code == 200
    assert response.json()[0] == {"category": "solar_system", "id": 30000142, "name": "Jita"}


def test_route() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/eve/route",
            params={"originId": 30000142, "destinationId": 30002187, "flag": "secure"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["jumps"] == 2
    assert body["systems"] == [30000142, 30000144, 30002187]
    assert [system["id"] for system in body["routeSystems"]] == [30000142, 30000144, 30002187]
    assert body["routeSystems"][0]["shipJumpsLastHour"] == 101
    assert body["routeSystems"][1]["shipJumpsLastHour"] == 7
    assert body["routeSystems"][2]["shipJumpsLastHour"] == 55


def test_route_keeps_systems_when_jump_traffic_fails() -> None:
    class FailingTrafficEsiClient(FakeEsiClient):
        async def system_jumps(self) -> list[dict]:
            raise EsiError(502, "Traffic unavailable")

    async def override_failing_traffic_client():
        yield FailingTrafficEsiClient()

    app.dependency_overrides[get_esi_client] = override_failing_traffic_client

    with TestClient(app) as client:
        response = client.get(
            "/api/eve/route",
            params={"originId": 30000142, "destinationId": 30002187, "flag": "secure"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["systems"] == [30000142, 30000144, 30002187]
    assert all(system["shipJumpsLastHour"] is None for system in body["routeSystems"])


def test_route_rejects_invalid_flag() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/eve/route",
            params={"originId": 30000142, "destinationId": 30002187, "flag": "reckless"},
        )

    assert response.status_code == 422


def test_route_defaults_to_secure() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/eve/route",
            params={"originId": 30000142, "destinationId": 30002187},
        )

    assert response.status_code == 200
    assert response.json()["flag"] == "secure"


def test_status() -> None:
    with TestClient(app) as client:
        response = client.get("/api/eve/status")

    assert response.status_code == 200
    body = response.json()
    assert body["players"] == 22144
    assert body["server_version"] == "2938421"
    assert body["vip"] is False
    assert "fetched_at" in body


def test_system_catalog_search_includes_supported_services() -> None:
    with TestClient(app) as client:
        jita = client.get("/api/eve/systems", params={"q": "Jita"}).json()
        tama = client.get("/api/eve/systems", params={"q": "Tama"}).json()
        thera = client.get("/api/eve/systems", params={"q": "Thera"}).json()
        zarzakh = client.get("/api/eve/systems", params={"q": "Zarzakh"}).json()
        niarja = client.get("/api/eve/systems", params={"q": "Niarja"}).json()

    assert jita[0]["serviceType"] == "HighSec"
    assert tama[0]["serviceType"] == "LowSec"
    assert thera[0]["serviceType"] == "Thera"
    assert zarzakh[0]["serviceType"] == "Zarzakh"
    assert niarja[0]["serviceType"] == "Pochven"


def test_system_catalog_search_excludes_nullsec_and_wormholes() -> None:
    with TestClient(app) as client:
        nullsec = client.get("/api/eve/systems", params={"q": "1DQ1-A"}).json()
        wormhole = client.get("/api/eve/systems", params={"q": "J100001"}).json()

    assert nullsec == []
    assert wormhole == []


def test_route_flag_policy() -> None:
    assert choose_route_flag(30000142, 30002187) == "secure"
    assert choose_route_flag(30002813, 30002718) == "shortest"
    assert choose_route_flag(30003504, 30002702) == "shortest"


@pytest.mark.asyncio
async def test_catalog_refresh_keeps_cache_on_esi_failure() -> None:
    catalog = SystemCatalog(
        [
            {
                "id": 30000142,
                "name": "Jita",
                "securityStatus": 0.9,
                "securityDisplay": "0.9",
                "regionId": 10000002,
                "regionName": "The Forge",
                "constellationId": 20000020,
                "serviceType": "HighSec",
                "color": "#6FCF97",
            }
        ]
    )

    class FailingEsiClient:
        async def systems(self) -> list[int]:
            raise RuntimeError("ESI offline")

    refreshed = await catalog.refresh_from_esi(FailingEsiClient())  # type: ignore[arg-type]

    assert refreshed is False
    assert catalog.search("Jita", 5)[0]["name"] == "Jita"
