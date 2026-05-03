from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analysis, auth, documents, history
from app.services.storage import init_database

app = FastAPI(
    title="Don't Sign Anything API",
    description="Educational document risk assistant API for Phase 1.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(analysis.router)
app.include_router(auth.router)
app.include_router(history.router)


@app.on_event("startup")
def startup() -> None:
    init_database()


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
