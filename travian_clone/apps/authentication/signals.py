from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.authentication.models import Player


@receiver(post_save, sender=Player)
def create_starter_village_for_new_player(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.username == "Natars":
        return

    from apps.game_engine.services import create_starter_village
    from apps.combat.models import Hero, PlayerHeroItem, HeroItem

    # ✅ خواندن ربع انتخابی کاربر که در PlayerManager.create_user ست شده بود
    starting_quadrant = getattr(instance, '_starting_quadrant', 'RANDOM')

    village = create_starter_village(instance, starting_quadrant=starting_quadrant)

    hero, hero_created = Hero.objects.get_or_create(player=instance, defaults={"home_village": village})

    if hero_created:
        starter_weapon = HeroItem.objects.filter(item_type="WEAPON").first()
        if starter_weapon:
            PlayerHeroItem.objects.create(hero=hero, item=starter_weapon, is_equipped=True)