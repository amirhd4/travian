from django.core.management.base import BaseCommand

from apps.combat.models import TroopType


class Command(BaseCommand):
    help = (
        "نیروهای پیش‌فرض مورد نیاز صفحه پادگان (Barracks.jsx) را می‌سازد. "
        "فرانت‌اند فعلا آی‌دی نیروها را '1' و '2' هاردکد کرده، پس این دستور "
        "باید روی یک دیتابیس تازه (بدون رکورد TroopType) اجرا شود تا همان "
        "دو آی‌دی به همین ترتیب ساخته شوند."
    )

    def handle(self, *args, **options):
        defaults_list = [
            {
                "name": "گرزدار",
                "tribe": "ROMAN",
                "attack_power": 40,
                "defense_infantry": 20,
                "defense_cavalry": 5,
                "speed": 6,
                "carry_capacity": 50,
                "wood_cost": 95,
                "clay_cost": 75,
                "iron_cost": 40,
                "crop_cost": 40,
                "crop_upkeep": 1,
                "base_train_time": 300,
                "is_siege_weapon": False,
            },
            {
                "name": "محافظ نیزه‌دار",
                "tribe": "ROMAN",
                "attack_power": 10,
                "defense_infantry": 35,
                "defense_cavalry": 60,
                "speed": 5,
                "carry_capacity": 40,
                "wood_cost": 145,
                "clay_cost": 70,
                "iron_cost": 85,
                "crop_cost": 40,
                "crop_upkeep": 1,
                "base_train_time": 360,
                "is_siege_weapon": False,
            },
        ]

        for data in defaults_list:
            name = data.pop("name")
            tribe = data.pop("tribe")
            obj, created = TroopType.objects.get_or_create(
                name=name, tribe=tribe, defaults=data
            )
            status = "ساخته شد" if created else "از قبل وجود داشت"
            self.stdout.write(self.style.SUCCESS(f"{obj.id} - {obj.name}: {status}"))