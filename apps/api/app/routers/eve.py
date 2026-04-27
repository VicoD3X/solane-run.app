from datetime import UTC, datetime, timedelta
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import get_esi_client, get_system_catalog
from ..esi import EsiClient, EsiError
from ..schemas import (
    EsiName,
    EsiResolvedNamesResponse,
    EsiStatusResponse,
    NamesRequest,
    ResolveNamesRequest,
    RouteFlag,
    RouteResponse,
    RouteSystemResponse,
    SolarSystemResponse,
)
from ..system_catalog import SystemCatalog, choose_route_flag

router = APIRouter(prefix="/api/eve", tags=["eve"])

SYSTEM_JUMPS_CACHE_SECONDS = 300
_system_jumps_cache: dict[int, int] | None = None
_system_jumps_cache_expires_at = datetime.min.replace(tzinfo=UTC)


@router.post("/resolve-names", response_model=EsiResolvedNamesResponse)
async def resolve_names(
    payload: ResolveNamesRequest,
    esi: Annotated[EsiClient, Depends(get_esi_client)],
) -> EsiResolvedNamesResponse:
    names = [name.strip() for name in payload.names if name.strip()]
    if not names:
        raise HTTPException(status_code=422, detail="At least one non-empty name is required.")

    try:
        return EsiResolvedNamesResponse.model_validate(await esi.resolve_names(names))
    except EsiError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.post("/names", response_model=list[EsiName])
async def names(
    payload: NamesRequest,
    esi: Annotated[EsiClient, Depends(get_esi_client)],
) -> list[EsiName]:
    try:
        return [EsiName.model_validate(item) for item in await esi.names(payload.ids)]
    except EsiError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.get("/systems", response_model=list[SolarSystemResponse])
async def systems(
    q: Annotated[str, Query(max_length=80)] = "",
    limit: Annotated[int, Query(ge=1, le=50)] = 12,
    catalog: SystemCatalog = Depends(get_system_catalog),
) -> list[SolarSystemResponse]:
    return [SolarSystemResponse.model_validate(system) for system in catalog.search(q, limit)]


@router.get("/route", response_model=RouteResponse)
async def route(
    origin_id: Annotated[int, Query(alias="originId", gt=0)],
    destination_id: Annotated[int, Query(alias="destinationId", gt=0)],
    flag: RouteFlag | None = None,
    esi: EsiClient = Depends(get_esi_client),
) -> RouteResponse:
    route_flag = flag or cast(RouteFlag, choose_route_flag(origin_id, destination_id))
    try:
        systems = await esi.route(origin_id, destination_id, route_flag)
    except EsiError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    system_jump_counts = await _system_jump_counts(esi)
    route_systems = await _route_systems(systems, esi, get_system_catalog(), system_jump_counts)

    return RouteResponse(
        origin_id=origin_id,
        destination_id=destination_id,
        flag=route_flag,
        systems=systems,
        routeSystems=route_systems,
        jumps=max(len(systems) - 1, 0),
    )


@router.get("/status", response_model=EsiStatusResponse)
async def status(esi: EsiClient = Depends(get_esi_client)) -> EsiStatusResponse:
    try:
        payload = await esi.status()
    except EsiError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    return EsiStatusResponse(
        players=payload["players"],
        server_version=payload["server_version"],
        start_time=payload["start_time"],
        vip=payload.get("vip", False),
        fetched_at=datetime.now(UTC).isoformat(),
    )


async def _route_systems(
    system_ids: list[int],
    esi: EsiClient,
    catalog: SystemCatalog,
    system_jump_counts: dict[int, int] | None = None,
) -> list[RouteSystemResponse]:
    route_systems: list[RouteSystemResponse] = []
    missing_ids: list[int] = []

    for system_id in system_ids:
        system = catalog.get(system_id)
        if system:
            route_systems.append(RouteSystemResponse.model_validate({
                "id": system["id"],
                "name": system["name"],
                "securityDisplay": system["securityDisplay"],
                "serviceType": system["serviceType"],
                "color": system["color"],
                "shipJumpsLastHour": _route_jump_count(system_id, system_jump_counts),
            }))
        else:
            missing_ids.append(system_id)

    if not missing_ids:
        return route_systems

    missing_names: dict[int, str] = {}
    try:
        missing_names = {
            item["id"]: item["name"]
            for item in await esi.names(missing_ids[:1000])
            if item.get("category") == "solar_system"
        }
    except EsiError:
        missing_names = {}

    known_by_id = {system.id: system for system in route_systems}
    ordered: list[RouteSystemResponse] = []
    for system_id in system_ids:
        known = known_by_id.get(system_id)
        if known:
            ordered.append(known)
        else:
            ordered.append(RouteSystemResponse(
                id=system_id,
                name=missing_names.get(system_id, str(system_id)),
                shipJumpsLastHour=_route_jump_count(system_id, system_jump_counts),
            ))

    return ordered


async def _system_jump_counts(esi: EsiClient) -> dict[int, int] | None:
    global _system_jumps_cache, _system_jumps_cache_expires_at

    now = datetime.now(UTC)
    if _system_jumps_cache is not None and now < _system_jumps_cache_expires_at:
        return _system_jumps_cache

    try:
        payload = await esi.system_jumps()
    except EsiError:
        return None

    counts: dict[int, int] = {}
    for item in payload:
        system_id = item.get("system_id")
        if system_id is None:
            continue
        counts[int(system_id)] = int(item.get("ship_jumps", 0))

    _system_jumps_cache = counts
    _system_jumps_cache_expires_at = now + timedelta(seconds=SYSTEM_JUMPS_CACHE_SECONDS)
    return counts


def _route_jump_count(system_id: int, counts: dict[int, int] | None) -> int | None:
    if counts is None:
        return None
    return counts.get(system_id, 0)
