from sqlmodel import SQLModel


class ScopeDataset(SQLModel):
    id: int
    name: str


class ScopeCollection(SQLModel):
    id: int
    name: str
    datasets: list[ScopeDataset] = []


class ScopePackage(SQLModel):
    id: int
    name: str
    collections: list[ScopeCollection] = []
