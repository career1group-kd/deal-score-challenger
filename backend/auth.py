"""
Simple password protection via session cookie.

If APP_PASSWORD is empty, all routes are open (no auth required).
"""

from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

TOKEN_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def _sign(value: str) -> str:
    settings = get_settings()
    sig = hmac.new(
        settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256
    ).hexdigest()
    return f"{value}.{sig}"


def _verify(token: str) -> bool:
    settings = get_settings()
    parts = token.rsplit(".", 1)
    if len(parts) != 2:
        return False
    value, sig = parts
    expected = hmac.new(
        settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        ts = int(value)
        return (time.time() - ts) < TOKEN_MAX_AGE
    except ValueError:
        return False


@router.post("/login")
async def login(request: Request):
    settings = get_settings()
    body = await request.json()
    if body.get("password") != settings.APP_PASSWORD:
        return JSONResponse({"error": "Falsches Passwort"}, status_code=401)
    token = _sign(str(int(time.time())))
    response = JSONResponse({"ok": True})
    response.set_cookie(
        "session",
        token,
        httponly=True,
        samesite="lax",
        max_age=TOKEN_MAX_AGE,
        secure=request.url.scheme == "https",
    )
    return response


@router.get("/check")
async def check(request: Request):
    settings = get_settings()
    if not settings.APP_PASSWORD:
        return {"authenticated": True}
    token = request.cookies.get("session")
    if token and _verify(token):
        return {"authenticated": True}
    return JSONResponse({"authenticated": False}, status_code=401)


@router.post("/logout")
async def logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie("session")
    return response


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        # No password configured → everything open
        if not settings.APP_PASSWORD:
            return await call_next(request)

        path = request.url.path

        # Allow auth endpoints and health check
        if path.startswith("/api/auth") or path == "/api/health":
            return await call_next(request)

        # Only protect /api/* routes
        if not path.startswith("/api"):
            return await call_next(request)

        token = request.cookies.get("session")
        if not token or not _verify(token):
            return JSONResponse({"error": "Not authenticated"}, status_code=401)

        return await call_next(request)
