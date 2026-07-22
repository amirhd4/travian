import random
from django.core.management.base import BaseCommand
from apps.game_engine.models import Village
from apps.game_engine.services import WW_VILLAGE_POSITIONS
from apps.authentication.models import Player
from apps.combat.models import TroopType, VillageTroop


class Command(BaseCommand):
    help = "ایجاد ناتارها و دهکده‌های شگفتی جهان در موقعیت‌های از پیش تعیین شده"

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='پاک کردن ناتارهای موجود')

    def handle(self, *args, **options):
        if options['clear']:
            Village.objects.filter(player__username="Natars").delete()
            self.stdout.write("ناتارهای موجود پاک شدند.")

        natar_player, _ = Player.objects.get_or_create(
            username="Natars", email="natars@game.com"
        )

        # Natars capital at (0,0)
        capital, created = Village.objects.get_or_create(
            player=natar_player,
            name="Natar Capital",
            x_coord=0, y_coord=0,
            defaults={
                "is_capital": True,
                "loyalty": 100,
                "wood": 999999, "clay": 999999, "iron": 999999, "crop": 999999,
                "prod_wood": 100000, "prod_clay": 100000, "prod_iron": 100000, "prod_crop": 100000,
                "max_storage": 999999, "max_granary": 999999,
            }
        )
        if created:
            self.stdout.write(f"پایتخت ناتار در (0,0) ایجاد شد.")
            self._spawn_natar_defense(capital, strength=50000)

        # WW villages at predefined positions
        for x, y in WW_VILLAGE_POSITIONS:
            village, created = Village.objects.get_or_create(
                player=natar_player,
                name=f"شگفتی جهان ({x}|{y})",
                x_coord=x, y_coord=y,
                defaults={
                    "is_capital": False,
                    "is_natar_ww_site": True,
                    "loyalty": 100,
                    "wood": 999999, "clay": 999999, "iron": 999999, "crop": 999999,
                    "prod_wood": 50000, "prod_clay": 50000, "prod_iron": 50000, "prod_crop": 50000,
                    "max_storage": 999999, "max_granary": 999999,
                }
            )
            if created:
                self.stdout.write(f"دهکده شگفتی جهان در ({x}|{y}) ایجاد شد.")
                self._spawn_natar_defense(village, strength=random.randint(5000, 10000))

        self.stdout.write(self.style.SUCCESS("ناتارها و شگفتی‌های جهان ایجاد شدند."))

    def _spawn_natar_defense(self, village, strength):
        natar_infantry, _ = TroopType.objects.get_or_create(
            name="نگهبان ناتار", tribe="NATAR",
            defaults={
                "attack_power": 40, "defense_infantry": 50, "defense_cavalry": 50,
                "speed": 0, "carry_capacity": 0,
                "wood_cost": 0, "clay_cost": 0, "iron_cost": 0, "crop_cost": 0,
                "crop_upkeep": 0, "base_train_time": 0,
            }
        )
        VillageTroop.objects.get_or_create(
            village=village, troop_type=natar_infantry,
            defaults={"count": strength}
        )
