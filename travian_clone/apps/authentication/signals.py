from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.authentication.models import Player


@receiver(post_save, sender=Player)
def create_starter_village_for_new_player(sender, instance, created, **kwargs):
    """
    قبل از این سیگنال، هیچ منطقی برای ساخت دهکده اولیه بازیکن تازه‌وارد
    وجود نداشت؛ کاربر بعد از ثبت‌نام هیچ Village ای نداشت.

    نکته: بازیکن "Natars" را استثنا می‌کنیم چون دهکده آن (Natar Capital)
    به صورت جداگانه و دستی توسط apps/world_wonder/logic.py ساخته می‌شود؛
    در غیر این صورت اینجا هم یک دهکده اضافه و بی‌مصرف برایش ساخته می‌شد.
    """
    if not created:
        return

    if instance.username == "Natars":
        return

    # ایمپورت داخل تابع برای جلوگیری از circular import بین اپ‌های
    # authentication و game_engine / combat در زمان بارگذاری اولیه اپ‌ها
    from apps.game_engine.services import create_starter_village
    from apps.combat.models import Hero, PlayerHeroItem, HeroItem

    village = create_starter_village(instance)

    # قبل از این، هیچ Hero ای برای بازیکن ساخته نمی‌شد؛ صفحه قهرمان
    # (Hero.jsx) برای هر بازیکن جدید ۴۰۴ یا داده خالی برمی‌گرداند.
    hero, hero_created = Hero.objects.get_or_create(player=instance, defaults={"home_village": village})

    if hero_created:
        # هدیه شروع بازی: اگر کاتالوگ آیتم قهرمان از قبل seed شده باشد
        # (python manage.py seed_game_data)، یک سلاح پایه به او بده.
        starter_weapon = HeroItem.objects.filter(item_type="WEAPON").first()
        if starter_weapon:
            PlayerHeroItem.objects.create(hero=hero, item=starter_weapon, is_equipped=True)