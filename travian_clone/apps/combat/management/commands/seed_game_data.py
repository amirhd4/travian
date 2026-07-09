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
            {
                "name": "سناتور",
                "tribe": "ROMAN",
                "attack_power": 50, "defense_infantry": 40, "defense_cavalry": 30,
                "speed": 4, "carry_capacity": 0,
                "wood_cost": 30750, "clay_cost": 27200, "iron_cost": 45000, "crop_cost": 37500,
                "crop_upkeep": 4, "base_train_time": 5400,
                "is_siege_weapon": False, "is_settler": False, "is_cavalry": False, "is_chief": True,
            },
        ]

        gaul_troops = [
            {
                "name": "جنگجوی نیزه‌دار گل",
                "tribe": "GAUL",
                "attack_power": 15, "defense_infantry": 40, "defense_cavalry": 30,
                "speed": 7, "carry_capacity": 55,
                "wood_cost": 60, "clay_cost": 90, "iron_cost": 40, "crop_cost": 40,
                "crop_upkeep": 1, "base_train_time": 260,
                "is_siege_weapon": False, "is_settler": False,
            },
            {
                "name": "شمشیرزن گلی",
                "tribe": "GAUL",
                "attack_power": 45, "defense_infantry": 20, "defense_cavalry": 15,
                "speed": 6, "carry_capacity": 55,
                "wood_cost": 140, "clay_cost": 150, "iron_cost": 185, "crop_cost": 60,
                "crop_upkeep": 1, "base_train_time": 380,
                "is_siege_weapon": False, "is_settler": False,
            },
            {
                "name": "مهاجر گلی",
                "tribe": "GAUL",
                "attack_power": 0, "defense_infantry": 20, "defense_cavalry": 10,
                "speed": 5, "carry_capacity": 3000,
                "wood_cost": 4400, "clay_cost": 4000, "iron_cost": 4600, "crop_cost": 5800,
                "crop_upkeep": 1, "base_train_time": 7200,
                "is_siege_weapon": False, "is_settler": True,
            },
            {
                "name": "ردیاب گلی",
                "tribe": "GAUL",
                "attack_power": 0, "defense_infantry": 20, "defense_cavalry": 10,
                "speed": 17, "carry_capacity": 0,
                "wood_cost": 170, "clay_cost": 150, "iron_cost": 20, "crop_cost": 40,
                "crop_upkeep": 1, "base_train_time": 700,
                "is_siege_weapon": False, "is_settler": False, "is_scout": True,
            },
            {
                "name": "سوار زوبین‌انداز",
                "tribe": "GAUL",
                "attack_power": 90, "defense_infantry": 25, "defense_cavalry": 40,
                "speed": 19, "carry_capacity": 75,
                "wood_cost": 350, "clay_cost": 450, "iron_cost": 230, "crop_cost": 60,
                "crop_upkeep": 2, "base_train_time": 1100,
                "is_siege_weapon": False, "is_settler": False, "is_cavalry": True,
            },
            {
                "name": "قوچ گلی",
                "tribe": "GAUL",
                "attack_power": 50, "defense_infantry": 30, "defense_cavalry": 105,
                "speed": 4, "carry_capacity": 0,
                "wood_cost": 950, "clay_cost": 555, "iron_cost": 330, "crop_cost": 75,
                "crop_upkeep": 3, "base_train_time": 2400,
                "is_siege_weapon": True, "is_settler": False, "is_cavalry": False,
            },
            {
                "name": "بالیستا گلی",
                "tribe": "GAUL",
                "attack_power": 70, "defense_infantry": 45, "defense_cavalry": 10,
                "speed": 3, "carry_capacity": 0,
                "wood_cost": 960, "clay_cost": 1450, "iron_cost": 630, "crop_cost": 90,
                "crop_upkeep": 3, "base_train_time": 3000,
                "is_siege_weapon": True, "is_settler": False, "is_cavalry": False,
            },
            {
                "name": "رئیس",
                "tribe": "GAUL",
                "attack_power": 40, "defense_infantry": 50, "defense_cavalry": 50,
                "speed": 5, "carry_capacity": 0,
                "wood_cost": 30750, "clay_cost": 27200, "iron_cost": 45000, "crop_cost": 37500,
                "crop_upkeep": 4, "base_train_time": 5400,
                "is_siege_weapon": False, "is_settler": False, "is_cavalry": False, "is_chief": True,
            },
        ]

        teuton_troops = [
            {
                "name": "کلوب‌دار توتونی",
                "tribe": "TEUTON",
                "attack_power": 40, "defense_infantry": 15, "defense_cavalry": 10,
                "speed": 7, "carry_capacity": 60,
                "wood_cost": 50, "clay_cost": 45, "iron_cost": 25, "crop_cost": 20,
                "crop_upkeep": 1, "base_train_time": 220,
                "is_siege_weapon": False, "is_settler": False,
            },
            {
                "name": "نیزه‌دار توتونی",
                "tribe": "TEUTON",
                "attack_power": 10, "defense_infantry": 35, "defense_cavalry": 60,
                "speed": 7, "carry_capacity": 40,
                "wood_cost": 70, "clay_cost": 25, "iron_cost": 40, "crop_cost": 20,
                "crop_upkeep": 1, "base_train_time": 300,
                "is_siege_weapon": False, "is_settler": False,
            },
            {
                "name": "مهاجر توتونی",
                "tribe": "TEUTON",
                "attack_power": 10, "defense_infantry": 30, "defense_cavalry": 20,
                "speed": 7, "carry_capacity": 3000,
                "wood_cost": 3700, "clay_cost": 3400, "iron_cost": 3800, "crop_cost": 3500,
                "crop_upkeep": 2, "base_train_time": 7200,
                "is_siege_weapon": False, "is_settler": True,
            },
            {
                "name": "کاراگاه توتونی",
                "tribe": "TEUTON",
                "attack_power": 0, "defense_infantry": 10, "defense_cavalry": 5,
                "speed": 9, "carry_capacity": 0,
                "wood_cost": 160, "clay_cost": 100, "iron_cost": 50, "crop_cost": 50,
                "crop_upkeep": 1, "base_train_time": 900,
                "is_siege_weapon": False, "is_settler": False, "is_scout": True,
            },
            {
                "name": "سوار پالادین",
                "tribe": "TEUTON",
                "attack_power": 55, "defense_infantry": 100, "defense_cavalry": 40,
                "speed": 10, "carry_capacity": 110,
                "wood_cost": 370, "clay_cost": 267, "iron_cost": 231, "crop_cost": 88,
                "crop_upkeep": 3, "base_train_time": 1300,
                "is_siege_weapon": False, "is_settler": False, "is_cavalry": True,
            },
            {
                "name": "قوچ توتونی",
                "tribe": "TEUTON",
                "attack_power": 65, "defense_infantry": 30, "defense_cavalry": 80,
                "speed": 4, "carry_capacity": 0,
                "wood_cost": 1050, "clay_cost": 350, "iron_cost": 550, "crop_cost": 160,
                "crop_upkeep": 3, "base_train_time": 2300,
                "is_siege_weapon": True, "is_settler": False, "is_cavalry": False,
            },
            {
                "name": "کاتاپولت توتونی",
                "tribe": "TEUTON",
                "attack_power": 50, "defense_infantry": 60, "defense_cavalry": 10,
                "speed": 3, "carry_capacity": 0,
                "wood_cost": 900, "clay_cost": 1200, "iron_cost": 600, "crop_cost": 260,
                "crop_upkeep": 3, "base_train_time": 3100,
                "is_siege_weapon": True, "is_settler": False, "is_cavalry": False,
            },
            {
                "name": "رئیس",
                "tribe": "TEUTON",
                "attack_power": 60, "defense_infantry": 30, "defense_cavalry": 25,
                "speed": 7, "carry_capacity": 0,
                "wood_cost": 35500, "clay_cost": 26600, "iron_cost": 25000, "crop_cost": 27200,
                "crop_upkeep": 4, "base_train_time": 5400,
                "is_siege_weapon": False, "is_settler": False, "is_cavalry": False, "is_chief": True,
            },
        ]

        troop_defaults_list.extend(gaul_troops)
        troop_defaults_list.extend(teuton_troops)

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