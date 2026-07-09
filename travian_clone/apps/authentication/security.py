import datetime
from django.core.cache import cache
from django.utils import timezone

# پیکربندی قفل حساب: بعد از این تعداد تلاش ناموفق در این بازه‌ی زمانی،
# حساب موقتا قفل می‌شود. این جدا از Rate Limiting سطح IP (throttles.py)
# است و مخصوصا جلوی brute force هدفمند روی یک نام‌کاربری/ایمیل مشخص را
# می‌گیرد - حتی اگر مهاجم IP خودش را عوض کند.
MAX_FAILED_ATTEMPTS = 5
ATTEMPTS_WINDOW_SECONDS = 900   # ۱۵ دقیقه
LOCKOUT_DURATION_SECONDS = 900  # ۱۵ دقیقه


def _attempts_key(username):
    return f"login_attempts:{username.strip().lower()}"


def _lockout_key(username):
    return f"login_lockout:{username.strip().lower()}"


def get_lockout_info(username):
    """اگر حساب قفل باشد (True, ثانیه‌های باقی‌مانده)، وگرنه (False, 0) برمی‌گرداند."""
    raw = cache.get(_lockout_key(username))
    if not raw:
        return False, 0
    unlock_at = datetime.datetime.fromisoformat(raw)
    remaining = (unlock_at - timezone.now()).total_seconds()
    if remaining <= 0:
        cache.delete(_lockout_key(username))
        return False, 0
    return True, int(remaining)


def register_failed_attempt(username):
    """یک تلاش ناموفق ثبت می‌کند؛ در صورت رسیدن به سقف، حساب را قفل می‌کند."""
    key = _attempts_key(username)
    try:
        attempts = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=ATTEMPTS_WINDOW_SECONDS)
        attempts = 1

    if attempts >= MAX_FAILED_ATTEMPTS:
        unlock_at = timezone.now() + datetime.timedelta(seconds=LOCKOUT_DURATION_SECONDS)
        cache.set(_lockout_key(username), unlock_at.isoformat(), timeout=LOCKOUT_DURATION_SECONDS)
        cache.delete(key)

    return attempts


def clear_failed_attempts(username):
    cache.delete(_attempts_key(username))
    cache.delete(_lockout_key(username))