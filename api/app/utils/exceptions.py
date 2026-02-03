from __future__ import annotations


class AppError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class ConflictError(AppError):
    pass


class NotFoundError(AppError):
    pass


class ForbiddenError(AppError):
    pass


class UnauthorizedError(AppError):
    pass
