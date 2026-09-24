from fastapi import APIRouter
import sys
import platform
from backend import __version__

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "version": __version__,
        "system": {
            "python": sys.version.split(" ")[0],
            "platform": platform.platform()
        }
    }
