"""
واحد پول ثانویه (نقره) و منطق تبدیل/کسر آن. طبق راهنما: ۱۰ سکه طلا = ۱٬۰۰۰ نقره
(هر سکه طلا = ۱۰۰ نقره). این فایل تنها منبع صحت این نرخ است تا در همه‌ی
نقاطی که هم طلا و هم نقره پذیرفته می‌شود (فروشگاه نیرو، حراجی قهرمان و ...)
یکسان باشد.
"""
from django.core.exceptions import ValidationError

SILVER_PER_GOLD = 100


def gold_equivalent(amount, currency):
    """مقدار داده‌شده (بر حسب currency) را به معادل طلا تبدیل می‌کند."""
    if currency == 'silver':
        return amount / SILVER_PER_GOLD
    return amount


def charge_player(player, amount, currency):
    """
    مبلغ (بر حسب همان currency، نه معادل طلا) را از کیف‌پول بازیکن کسر
    می‌کند. در صورت موجودی ناکافی یا ورودی نامعتبر ValidationError می‌دهد.
    """
    if currency not in ('gold', 'silver'):
        raise ValidationError("واحد پول نامعتبر است.")
    if amount <= 0:
        raise ValidationError("مقدار پرداخت باید مثبت باشد.")

    if currency == 'gold':
        if player.gold_coins < amount:
            raise ValidationError("سکه طلای کافی ندارید.")
        player.gold_coins -= amount
        player.save(update_fields=['gold_coins'])
    else:
        if player.silver_coins < amount:
            raise ValidationError("نقره کافی ندارید.")
        player.silver_coins -= amount
        player.save(update_fields=['silver_coins'])


def refund_player(player, amount, currency):
    if currency == 'silver':
        player.silver_coins += amount
    else:
        player.gold_coins += amount
    player.save(update_fields=['gold_coins', 'silver_coins'])