from collections.abc import Sequence
from typing import Any

import httpx

from .config import settings
from .schemas import RouteFlag


class EsiError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class EsiClient:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> "EsiClient":
        if self._client is None:
            self._client = self._build_client()
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()

    def _build_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=settings.esi_base_url,
            timeout=httpx.Timeout(12.0),
            headers={
                "Accept": "application/json",
                "User-Agent": settings.esi_user_agent,
                "X-Compatibility-Date": settings.esi_compatibility_date,
            },
        )

    async def resolve_names(self, names: Sequence[str]) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/universe/ids/",
            json=list(names),
            params={"datasource": settings.esi_datasource},
        )

    async def names(self, ids: Sequence[int]) -> list[dict[str, Any]]:
        return await self._request(
            "POST",
            "/universe/names/",
            json=list(ids),
            params={"datasource": settings.esi_datasource},
        )

    async def route(self, origin_id: int, destination_id: int, flag: RouteFlag) -> list[int]:
        return await self._request(
            "GET",
            f"/route/{origin_id}/{destination_id}/",
            params={"datasource": settings.esi_datasource, "flag": flag},
        )

    async def status(self) -> dict[str, Any]:
        return await self._request(
            "GET",
            "/status/",
            params={"datasource": settings.esi_datasource},
        )

    async def system_jumps(self) -> list[dict[str, Any]]:
        return await self._request(
            "GET",
            "/universe/system_jumps/",
            params={"datasource": settings.esi_datasource},
        )

    async def systems(self) -> list[int]:
        return await self._request(
            "GET",
            "/universe/systems/",
            params={"datasource": settings.esi_datasource},
        )

    async def system(self, system_id: int) -> dict[str, Any]:
        return await self._request(
            "GET",
            f"/universe/systems/{system_id}/",
            params={"datasource": settings.esi_datasource},
        )

    async def constellation(self, constellation_id: int) -> dict[str, Any]:
        return await self._request(
            "GET",
            f"/universe/constellations/{constellation_id}/",
            params={"datasource": settings.esi_datasource},
        )

    async def region(self, region_id: int) -> dict[str, Any]:
        return await self._request(
            "GET",
            f"/universe/regions/{region_id}/",
            params={"datasource": settings.esi_datasource},
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if self._client is None:
            self._client = self._build_client()

        try:
            response = await self._client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            detail = _esi_detail(exc.response)
            raise EsiError(exc.response.status_code, detail) from exc
        except httpx.HTTPError as exc:
            raise EsiError(502, "Unable to reach EVE ESI.") from exc


def _esi_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or "Unexpected ESI response."

    if isinstance(payload, dict):
        return str(payload.get("error") or payload.get("message") or "Unexpected ESI response.")
    return "Unexpected ESI response."
