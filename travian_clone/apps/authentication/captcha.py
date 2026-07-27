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
    code = _random_code()
    token = uuid.uuid4().hex
    cache.set(f"captcha:{token}", code, timeout=CAPTCHA_TTL_SECONDS)

    # ۱. افزایش کمی ابعاد عکس برای وضوح بیشتر
    width, height = 180, 65
    image = Image.new('RGB', (width, height), color=(245, 238, 218))  # تم چوبی روشن
    draw = ImageDraw.Draw(image)

    # ۲. خطوط نویز کمتر و باریک‌تر (برای نینداختن سایه/ابهام روی اعداد)
    for _ in range(3):
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        draw.line((x1, y1, x2, y2), fill=(180, 160, 130), width=1)

    # ۳. بزرگ‌تر کردن سایز فونت
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 38)
    except IOError:
        font = ImageFont.load_default()

    # ۴. رسم شفاف و خواناتر اعداد
    for i, digit in enumerate(code):
        x = 12 + i * 32 + random.randint(-2, 2)  # فاصله منطقی‌تر بین حروف
        y = 6 + random.randint(-3, 3)  # جابه‌جایی عمودی کمتر
        angle = random.randint(-10, 25)  # چرخش ملایم‌تر (دیگه اعداد نامفهوم نمیشن)

        digit_img = Image.new('RGBA', (42, 48), (0, 0, 0, 0))
        digit_draw = ImageDraw.Draw(digit_img)
        # رنگ قهوه‌ای تیره پررنگ‌تر جهت وضوح بالاتر
        digit_draw.text((6, 2), digit, font=font, fill=(50, 30, 15))

        digit_img = digit_img.rotate(angle, expand=True)
        image.paste(digit_img, (x, y), digit_img)

    # ۵. کاهش نقاط نویز پس‌زمینه
    for _ in range(35):
        x, y = random.randint(0, width - 1), random.randint(0, height - 1)
        draw.point((x, y), fill=(160, 140, 110))

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
    cache.delete(cache_key)
    return str(answer).strip() == correct_code