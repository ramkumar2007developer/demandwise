from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Application-level error with a stable JSON shape."""

    def __init__(self, message: str, status_code: int = 400, code: str = "app_error") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def _error_body(code: str, message: str, details: object | None = None) -> dict:
    body: dict = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body("validation_error", "Request validation failed.", jsonable_encoder(exc.errors())),
        )

    @app.exception_handler(ValidationError)
    async def handle_pydantic_validation(_request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body("validation_error", "Data validation failed.", jsonable_encoder(exc.errors())),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body("http_error", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=_error_body("internal_error", "An unexpected server error occurred."),
        )
