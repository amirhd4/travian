import random
import io
import base64
import uuid

from PIL import Image, ImageDraw, ImageFont
from django.core.cache import cache

CAPTCHA_TTL_SECONDS = 300  # ۵ دقیقه اعتبار هر کپچا
CAPTCHA_LENGTH = 5


def _random_code():
    return ''.join(random.choices('0123456789', k=CAPTCHA_LENGTH))


def generate_captcha():
    """
    یک کپچای ساده‌ی عددی (شبیه کپچای صفحه‌ی ثبت‌نام تراوین اصلی) می‌سازد:
    یک عکس PNG با اعداد کج‌ونامنظم و نویز پس‌زمینه، به‌همراه یک توکن
    یک‌بارمصرف که مقدار صحیح را در کش سرور (نه در کلاینت) نگه می‌دارد.

    از هیچ سرویس بیرونی (Google reCAPTCHA/hCaptcha و ...) استفاده نمی‌شود،
    پس نیازی به ثبت‌نام یا کلید API ندارد.
    """
    code = _random_code()
    token = uuid.uuid4().hex
    cache.set(f"captcha:{token}", code, timeout=CAPTCHA_TTL_SECONDS)

    width, height = 160, 60
    image = Image.new('RGB', (width, height), color=(244, 235, 208))  # هم‌رنگ با تم چوبی صفحه
    draw = ImageDraw.Draw(image)

    for _ in range(6):
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        draw.line((x1, y1, x2, y2), fill=(150, 120, 90), width=1)

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 32)
    except IOError:
        font = ImageFont.load_default()

    for i, digit in enumerate(code):
        x = 12 + i * 28 + random.randint(-4, 4)
        y = 10 + random.randint(-6, 6)
        angle = random.randint(-25, 25)
        digit_img = Image.new('RGBA', (36, 40), (0, 0, 0, 0))
        digit_draw = ImageDraw.Draw(digit_img)
        digit_draw.text((6, 2), digit, font=font, fill=(89, 61, 43))
        digit_img = digit_img.rotate(angle, expand=True)
        image.paste(digit_img, (x, y), digit_img)

    for _ in range(80):
        x, y = random.randint(0, width - 1), random.randint(0, height - 1)
        draw.point((x, y), fill=(150, 120, 90))

    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return token, f"data:image/png;base64,{encoded}"


def verify_captcha(token, answer):
    """بررسی و مصرف (تک‌بارمصرف) یک توکن کپچا."""
    if not token or not answer:
        return False
    cache_key = f"captcha:{token}"
    correct_code = cache.get(cache_key)
    if correct_code is None:
        return False
    cache.delete(cache_key)  # چه درست چه غلط، دیگر قابل استفاده مجدد نیست
    return str(answer).strip() == correct_code