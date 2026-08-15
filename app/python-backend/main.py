from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import uuid

app = FastAPI(title="J.A.R.V.I.S. Auth Core API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    email: EmailStr
    passkey: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    passkey: str


class FaceVerifyRequest(BaseModel):
    image_base64: str


@app.post("/api/v1/auth/register")
def register_operative(req: RegisterRequest):
    return {
        "success": True,
        "user": {
            "uid": f"PY-{uuid.uuid4().hex[:6].upper()}",
            "email": req.email,
            "fullName": req.full_name,
            "clearanceLevel": "Level 1",
            "hasBiometrics": False,
        },
    }


@app.post("/api/v1/auth/login")
def login_operative(req: LoginRequest):
    return {
        "success": True,
        "user": {
            "uid": "PY-1001",
            "email": req.email,
            "fullName": "Tony Stark (FastAPI)",
            "clearanceLevel": "Level 1",
            "hasBiometrics": True,
        },
    }


@app.get("/api/v1/auth/webauthn/options")
def webauthn_options(email: str):
    return {"challenge": "FASTAPI_JARVIS_FIDO2_CHALLENGE", "rpId": "localhost"}


@app.post("/api/v1/auth/verify-face")
def verify_face(req: FaceVerifyRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Missing base64 frame stream")
    return {
        "success": True,
        "user": {
            "uid": "PY-8802",
            "email": "stark@avengers.io",
            "fullName": "Tony Stark (FastAPI Face Match)",
            "clearanceLevel": "Level 1",
            "hasBiometrics": True,
        },
    }


@app.post("/api/v1/auth/verify-voice")
async def verify_voice(file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty audio payload")
    return {
        "success": True,
        "user": {
            "uid": "PY-7703",
            "email": "stark@avengers.io",
            "fullName": "Tony Stark (FastAPI Voice Match)",
            "clearanceLevel": "Level 1",
            "hasBiometrics": True,
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
