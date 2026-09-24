from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class CodeFile(BaseModel):
    name: str
    lang: str = "python"
    code: str

class ClassModule(BaseModel):
    id: int
    class_num: int
    week: int
    tag: str
    title: str
    short: str
    color: str = "cyan"
    description: str
    topics: List[str] = Field(default_factory=list)
    code_file: Optional[str] = None
    directory: str
    readme_preview: Optional[str] = None

class ClassDetail(BaseModel):
    id: int
    title: str
    short: str
    week: int
    meta: Dict[str, Any] = Field(default_factory=dict)
    html: str
    diagrams: List[str] = Field(default_factory=list)
    toc: List[str] = Field(default_factory=list)
    files: List[CodeFile] = Field(default_factory=list)
    folder: str

class CapstoneProject(BaseModel):
    id: str
    slug: str
    title: str
    short: str
    domain: str
    pattern: str
    metric: str
    color: str = "violet"
    description: str
    architecture: List[str] = Field(default_factory=list)
    directory: str
    entrypoint: str
    api_available: bool = False

class CapstoneDetail(BaseModel):
    slug: str
    title: str
    short: str
    domain: str
    pattern: str
    metric: str
    html: str
    diagrams: List[str] = Field(default_factory=list)
    toc: List[str] = Field(default_factory=list)
    files: List[CodeFile] = Field(default_factory=list)
    folder: str

class WeekInfo(BaseModel):
    n: int
    title: str
    classes: List[int] = Field(default_factory=list)
    summary: str
    tools: List[str] = Field(default_factory=list)

class CurriculumOverview(BaseModel):
    weeks: List[WeekInfo] = Field(default_factory=list)
    classes: Dict[str, Any] = Field(default_factory=dict)
    capstones: List[Dict[str, Any]] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)

class TechStackItem(BaseModel):
    name: str
    category: str
    description: str
    badge: Optional[str] = None
