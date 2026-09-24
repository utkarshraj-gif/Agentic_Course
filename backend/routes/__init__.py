from .health import router as health_router
from .curriculum import router as curriculum_router
from .capstones import router as capstones_router
from .agents import router as agents_router
from .storage import router as storage_router
from .admin import router as admin_router
from .compiler import router as compiler_router
from .diagrams import router as diagrams_router

__all__ = ["health_router", "curriculum_router", "capstones_router", "agents_router", "storage_router", "admin_router", "compiler_router", "diagrams_router"]

