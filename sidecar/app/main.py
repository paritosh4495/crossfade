from fastapi import FastAPI

app = FastAPI(title="crossfade-sidecar")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "up"}
