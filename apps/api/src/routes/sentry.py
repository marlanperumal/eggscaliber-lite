from fastapi import APIRouter

router = APIRouter(tags=["sentry"])


@router.get("/sentry-debug")
async def trigger_error():
    # Exception: intentionally raises ZeroDivisionError to trigger Sentry. Never returns a
    # response, so response_model and return-type annotation are intentionally omitted.
    division_by_zero = 1 / 0
    return division_by_zero
