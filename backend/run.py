import uvicorn
import sys
from pathlib import Path

# Add project root and backend dir to sys.path so modules resolve whether run from root or backend/
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
for p in [str(BACKEND_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.config import HOST, PORT

if __name__ == "__main__":
    print(f"Starting Agentic AI Course Backend API on http://{HOST}:{PORT}")
    print(f"Swagger API Docs: http://localhost:{PORT}/docs")
    print(f"Frontend: http://localhost:{PORT}/")
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
