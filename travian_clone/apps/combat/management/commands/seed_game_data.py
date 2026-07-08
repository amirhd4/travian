from django.core.management.base import BaseCommand

from apps.combat.models import TroopType, Animal, HeroItem


class Command(BaseCommand):
    help = (
        "دیتای پایه بازی را می‌سازد: نیروهای پیش‌فرض پادگان (Barracks.jsx آی‌دی‌های "
        "'1' و '2' را هاردکد کرده)، یک نیروی مهاجر برای تاسیس دهکده جدید (Colonize.jsx "
        "آی‌دی '3' را هاردکد کرده)، و چند حیوان نگهبان / آیتم قهرمان پیش‌فرض. باید روی "
        "یک دیتابیس تازه اجرا شود تا همین آی‌دی‌ها به همین ترتیب ساخته شوند."
    )

    def handle(self, *args, **options):
        troop_defaults_list = [
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
                "is_settler": False,
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
                "is_settler": False,
            },
            {
                "name": "مهاجر",
                "tribe": "ROMAN",
                "attack_power": 0,
                "defense_infantry": 20,
                "defense_cavalry": 10,
                "speed": 5,
                "carry_capacity": 3000,
                "wood_cost": 4600,
                "clay_cost": 4200,
                "iron_cost": 5800,
                "crop_cost": 4400,
                "crop_upkeep": 1,
                "base_train_time": 7200,
                "is_siege_weapon": False,
                "is_settler": True,
            },
            {
                "name": "کاراگاه",
                "tribe": "ROMAN",
                "attack_power": 0,
                "defense_infantry": 5,
                "defense_cavalry": 5,
                "speed": 9,
                "carry_capacity": 0,
                "wood_cost": 100,
                "clay_cost": 200,
                "iron_cost": 150,
                "crop_cost": 50,
                "crop_upkeep": 1,
                "base_train_time": 900,
                "is_siege_weapon": False,
                "is_settler": False,
                "is_scout": True,
            },
            {
                "name": "شوالیه سوار",
                "tribe": "ROMAN",
                "attack_power": 120,
                "defense_infantry": 65,
                "defense_cavalry": 50,
                "speed": 14,
                "carry_capacity": 100,
                "wood_cost": 550, "clay_cost": 440, "iron_cost": 320, "crop_cost": 100,
                "crop_upkeep": 3, "base_train_time": 1200,
                "is_siege_weapon": False, "is_settler": False, "is_cavalry": True,
            },
            {
                "name": "قوچ آهنین",
                "tribe": "ROMAN",
                "attack_power": 60, "defense_infantry": 30, "defense_cavalry": 45,
                "speed": 4, "carry_capacity": 0,
                "wood_cost": 950, "clay_cost": 555, "iron_cost": 330, "crop_cost": 220,
                "crop_upkeep": 3, "base_train_time": 2400,
                "is_siege_weapon": True, "is_settler": False, "is_cavalry": False,
            },
            {
                "name": "منجنیق",
                "tribe": "ROMAN",
                "attack_power": 75, "defense_infantry": 60, "defense_cavalry": 10,
                "speed": 3, "carry_capacity": 0,
                "wood_cost": 950, "clay_cost": 1350, "iron_cost": 600, "crop_cost": 180,
                "crop_upkeep": 3, "base_train_time": 3000,
                "is_siege_weapon": True, "is_settler": False, "is_cavalry": False,
            },
        ]

        for data in troop_defaults_list:
            name = data.pop("name")
            tribe = data.pop("tribe")
            obj, created = TroopType.objects.get_or_create(
                name=name, tribe=tribe, defaults=data
            )
            status = "ساخته شد" if created else "از قبل وجود داشت"
            self.stdout.write(self.style.SUCCESS(f"[TroopType] {obj.id} - {obj.name}: {status}"))

        animal_defaults_list = [
            {"name": "گراز وحشی", "defense_infantry": 20, "defense_cavalry": 10, "gold_price": 5},
            {"name": "خرس", "defense_infantry": 50, "defense_cavalry": 30, "gold_price": 15},
            {"name": "ببر", "defense_infantry": 80, "defense_cavalry": 60, "gold_price": 30},
        ]
        for data in animal_defaults_list:
            name = data.pop("name")
            obj, created = Animal.objects.get_or_create(name=name, defaults=data)
            status = "ساخته شد" if created else "از قبل وجود داشت"
            self.stdout.write(self.style.SUCCESS(f"[Animal] {obj.id} - {obj.name}: {status}"))

        hero_item_defaults_list = [
            {"name": "کلاه‌خود آهنین", "item_type": "HELMET", "attack_bonus": 0, "speed_bonus": 0},
            {"name": "شمشیر جنگی", "item_type": "WEAPON", "attack_bonus": 50, "speed_bonus": 0},
            {"name": "اسب تندرو", "item_type": "HORSE", "attack_bonus": 0, "speed_bonus": 2},
        ]
        for data in hero_item_defaults_list:
            name = data.pop("name")
            obj, created = HeroItem.objects.get_or_create(name=name, defaults=data)
            status = "ساخته شد" if created else "از قبل وجود داشت"
            self.stdout.write(self.style.SUCCESS(f"[HeroItem] {obj.id} - {obj.name}: {status}"))