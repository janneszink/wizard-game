from fastapi import FastAPI

app = FastAPI(title="Wizard Game API")

@app.get("/")

def health_check() -> dict:

    return {

        "status": "ok",

        "message": "Wizard Game API is running."

    }