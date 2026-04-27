from typing import Literal

from pydantic import BaseModel, Field


RouteFlag = Literal["shortest", "secure", "insecure"]
ServiceType = Literal["Pochven", "Thera", "HighSec", "LowSec", "Zarzakh"]


class HealthResponse(BaseModel):
    status: str
    service: str


class ResolveNamesRequest(BaseModel):
    names: list[str] = Field(..., min_length=1, max_length=500)


class NamesRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=1000)


class EsiResolvedGroup(BaseModel):
    id: int
    name: str


class EsiResolvedNamesResponse(BaseModel):
    agents: list[EsiResolvedGroup] = []
    alliances: list[EsiResolvedGroup] = []
    characters: list[EsiResolvedGroup] = []
    constellations: list[EsiResolvedGroup] = []
    corporations: list[EsiResolvedGroup] = []
    factions: list[EsiResolvedGroup] = []
    inventory_types: list[EsiResolvedGroup] = []
    regions: list[EsiResolvedGroup] = []
    stations: list[EsiResolvedGroup] = []
    systems: list[EsiResolvedGroup] = []


class EsiName(BaseModel):
    category: str
    id: int
    name: str


class EsiStatusResponse(BaseModel):
    players: int
    server_version: str
    start_time: str
    vip: bool = False
    fetched_at: str


class SolarSystemResponse(BaseModel):
    id: int
    name: str
    securityStatus: float
    securityDisplay: str
    regionId: int
    regionName: str
    constellationId: int
    serviceType: ServiceType
    color: str


class RouteSystemResponse(BaseModel):
    id: int
    name: str
    securityDisplay: str | None = None
    serviceType: str | None = None
    color: str | None = None
    shipJumpsLastHour: int | None = None


class RouteResponse(BaseModel):
    origin_id: int
    destination_id: int
    flag: RouteFlag
    systems: list[int]
    routeSystems: list[RouteSystemResponse] = Field(default_factory=list)
    jumps: int
