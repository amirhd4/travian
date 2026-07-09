from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class LoginIPThrottle(AnonRateThrottle):
    """محدودیت تعداد تلاش ورود بر اساس IP - جلوگیری از brute force پرحجم."""
    scope = 'login_ip'


class LoginUsernameThrottle(SimpleRateThrottle):
    """
    محدودیت تعداد تلاش ورود بر اساس نام‌کاربری/ایمیل وارد شده - جلوگیری
    از brute force هدفمند روی یک حساب مشخص، حتی اگر مهاجم از IPهای
    مختلف استفاده کند.
    """
    scope = 'login_username'

    def get_cache_key(self, request, view):
        username = (request.data.get('username') or '').strip().lower()
        if not username:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': username}


class RegisterIPThrottle(AnonRateThrottle):
    """محدودیت تعداد ثبت‌نام بر اساس IP - جلوگیری از اسپم ساخت اکانت."""
    scope = 'register_ip'


class CaptchaIPThrottle(AnonRateThrottle):
    """محدودیت تعداد درخواست کپچای جدید بر اساس IP."""
    scope = 'captcha_ip'