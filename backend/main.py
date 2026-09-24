from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from backend.config import FRONTEND_DIR, CORS_ORIGINS
from backend.routes import health_router, curriculum_router, capstones_router, agents_router, storage_router, admin_router, compiler_router, diagrams_router
from backend.db.database import init_db

app = FastAPI(
    title="Building Enterprise AI Agents - Platform API",
    description="Backend API powering the Agentic AI Course: serving curriculum metadata, capstone specs, live agent executions, and NeonDB persistent state.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.on_event("startup")
def on_startup():
    try:
        init_db()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Database init warning (will retry on demand): {e}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    )

# Register API routes under /api
app.include_router(health_router, prefix="/api")
app.include_router(curriculum_router, prefix="/api")
app.include_router(capstones_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(storage_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(compiler_router, prefix="/api")
app.include_router(diagrams_router, prefix="/api")

# Serve Frontend static files if the directory exists
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Frontend index.html not found"}
