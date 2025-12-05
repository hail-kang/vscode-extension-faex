"""
Sample FastAPI router for testing faex-vscode extension.
Open this file with the extension active to see diagnostics.
"""

from fastapi import APIRouter

# Custom exceptions (simulated)
class UnauthorizedException(Exception):
    pass

class NotFoundException(Exception):
    pass

class ForbiddenException(Exception):
    pass


router = APIRouter()


# Example 1: Properly declared exceptions
@router.get(
    "/users/{user_id}",
    exceptions=[UnauthorizedException, NotFoundException],
)
async def get_user(user_id: int):
    """This endpoint has all exceptions properly declared."""
    if not is_authenticated():
        raise UnauthorizedException()

    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundException()

    return user


# Example 2: Missing exception declaration
@router.post(
    "/users/{user_id}/action",
    exceptions=[UnauthorizedException],  # Missing: ForbiddenException
)
async def perform_action(user_id: int):
    """This endpoint is missing ForbiddenException in declarations."""
    if not is_authenticated():
        raise UnauthorizedException()

    if not has_permission():
        raise ForbiddenException()  # This should trigger a warning

    return {"status": "ok"}


# Example 3: No exceptions declared but raises them
@router.delete(
    "/users/{user_id}",
    # No exceptions parameter - both exceptions are undeclared
)
async def delete_user(user_id: int):
    """This endpoint has no exception declarations."""
    if not is_authenticated():
        raise UnauthorizedException()

    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundException()

    await delete_user_from_db(user_id)
    return {"deleted": True}


# Example 4: Health check - no exceptions
@router.get("/health")
async def health_check():
    """This endpoint doesn't raise any exceptions."""
    return {"status": "healthy"}


# Helper functions (simulated)
def is_authenticated() -> bool:
    return True

def has_permission() -> bool:
    return True

async def get_user_by_id(user_id: int):
    return {"id": user_id, "name": "Test User"}

async def delete_user_from_db(user_id: int):
    pass
