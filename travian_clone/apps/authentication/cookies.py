from django.conf import settings


def set_refresh_cookie(response, refresh_token):
    """توکن رفرش رو به صورت httpOnly cookie روی پاسخ ست می‌کنه."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=str(refresh_token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=settings.AUTH_COOKIE_PATH,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response


def clear_refresh_cookie(response):
    """کوکی رفرش توکن رو موقع خروج یا نامعتبر شدن پاک می‌کنه."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response