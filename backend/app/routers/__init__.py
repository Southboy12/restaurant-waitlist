from .parties import router as parties_router
from .auth import router as auth_router

__all__ = ["parties_router", "auth_router"]
