from django.core.management.base import BaseCommand

from apps.combat.models import TroopType, Animal, HeroItem


class Command(BaseCommand):
    help = "ایجاد دیتای پایه نیروها با آمار صحیح تراوین اصلی (۱۰ نیرو برای هر قبیله)."

    def handle(self, *args, **options):
        # ═══════════════════════════════════════════════════════
        # ROMAN Troops (IDs 1-10) — Standard Travian Order
        # ═══════════════════════════════════════════════════════
        roman_troops = [
            # 1. Legionnaire (basic infantry)
            {"name": "گرزدار", "tribe": "ROMAN", "attack_power": 40, "defense_infantry": 35, "defense_cavalry": 50,
             "speed": 6, "carry_capacity": 50, "wood_cost": 120, "clay_cost": 100, "iron_cost": 150, "crop_cost": 30,
             "crop_upkeep": 1, "base_train_time": 1600, "is_siege_weapon": False, "is_settler": False},
            # 2. Praetorian (defense infantry)
            {"name": "محافظ نیزه‌دار", "tribe": "ROMAN", "attack_power": 30, "defense_infantry": 65, "defense_cavalry": 35,
             "speed": 5, "carry_capacity": 20, "wood_cost": 100, "clay_cost": 130, "iron_cost": 160, "crop_cost": 70,
             "crop_upkeep": 1, "base_train_time": 1760, "is_siege_weapon": False, "is_settler": False},
            # 3. Imperian (offense infantry)
            {"name": "امپراتوری", "tribe": "ROMAN", "attack_power": 70, "defense_infantry": 40, "defense_cavalry": 25,
             "speed": 6, "carry_capacity": 50, "wood_cost": 150, "clay_cost": 100, "iron_cost": 60, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1760, "is_siege_weapon": False, "is_settler": False},
            # 4. Equites Legati (scout)
            {"name": "کاراگاه", "tribe": "ROMAN", "attack_power": 0, "defense_infantry": 20, "defense_cavalry": 10,
             "speed": 16, "carry_capacity": 0, "wood_cost": 140, "clay_cost": 160, "iron_cost": 20, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1360, "is_siege_weapon": False, "is_settler": False, "is_scout": True},
            # 5. Equites Imperatoris (light cavalry)
            {"name": "شوالیه سوار", "tribe": "ROMAN", "attack_power": 120, "defense_infantry": 65, "defense_cavalry": 50,
             "speed": 14, "carry_capacity": 100, "wood_cost": 550, "clay_cost": 440, "iron_cost": 320, "crop_cost": 100,
             "crop_upkeep": 3, "base_train_time": 2640, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 6. Equites Caesaris (heavy cavalry)
            {"name": "سوار سناتور", "tribe": "ROMAN", "attack_power": 180, "defense_infantry": 80, "defense_cavalry": 105,
             "speed": 10, "carry_capacity": 110, "wood_cost": 650, "clay_cost": 300, "iron_cost": 360, "crop_cost": 180,
             "crop_upkeep": 4, "base_train_time": 4600, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 7. Battering Ram
            {"name": "قوچ آهنین", "tribe": "ROMAN", "attack_power": 60, "defense_infantry": 30, "defense_cavalry": 75,
             "speed": 4, "carry_capacity": 0, "wood_cost": 900, "clay_cost": 360, "iron_cost": 500, "crop_cost": 70,
             "crop_upkeep": 3, "base_train_time": 4600, "is_siege_weapon": True, "is_ram": True, "is_settler": False},
            # 8. Onager (catapult)
            {"name": "منجنیق", "tribe": "ROMAN", "attack_power": 75, "defense_infantry": 60, "defense_cavalry": 10,
             "speed": 3, "carry_capacity": 0, "wood_cost": 900, "clay_cost": 1200, "iron_cost": 600, "crop_cost": 90,
             "crop_upkeep": 6, "base_train_time": 9000, "is_siege_weapon": True, "is_catapult": True, "is_settler": False},
            # 9. Senator (chief)
            {"name": "سناتور", "tribe": "ROMAN", "attack_power": 50, "defense_infantry": 40, "defense_cavalry": 30,
             "speed": 5, "carry_capacity": 0, "wood_cost": 30750, "clay_cost": 27200, "iron_cost": 45000, "crop_cost": 37500,
             "crop_upkeep": 5, "base_train_time": 90700, "is_siege_weapon": False, "is_settler": False, "is_chief": True},
            # 10. Settler
            {"name": "مهاجر", "tribe": "ROMAN", "attack_power": 0, "defense_infantry": 80, "defense_cavalry": 80,
             "speed": 5, "carry_capacity": 3000, "wood_cost": 5800, "clay_cost": 5300, "iron_cost": 7200, "crop_cost": 5500,
             "crop_upkeep": 1, "base_train_time": 26900, "is_siege_weapon": False, "is_settler": True},
        ]

        # ═══════════════════════════════════════════════════════
        # GAUL Troops (IDs 11-20) — Standard Travian Order
        # ═══════════════════════════════════════════════════════
        gaul_troops = [
            # 11. Phalanx (basic infantry)
            {"name": "جنگجوی نیزه‌دار گل", "tribe": "GAUL", "attack_power": 15, "defense_infantry": 40, "defense_cavalry": 50,
             "speed": 7, "carry_capacity": 35, "wood_cost": 100, "clay_cost": 130, "iron_cost": 55, "crop_cost": 30,
             "crop_upkeep": 1, "base_train_time": 1040, "is_siege_weapon": False, "is_settler": False},
            # 12. Swordsman (offense infantry)
            {"name": "شمشیرزن گلی", "tribe": "GAUL", "attack_power": 65, "defense_infantry": 35, "defense_cavalry": 20,
             "speed": 6, "carry_capacity": 45, "wood_cost": 140, "clay_cost": 150, "iron_cost": 185, "crop_cost": 60,
             "crop_upkeep": 1, "base_train_time": 1440, "is_siege_weapon": False, "is_settler": False},
            # 13. Pathfinder (scout)
            {"name": "ردیاب گلی", "tribe": "GAUL", "attack_power": 0, "defense_infantry": 20, "defense_cavalry": 10,
             "speed": 17, "carry_capacity": 0, "wood_cost": 170, "clay_cost": 150, "iron_cost": 20, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1320, "is_siege_weapon": False, "is_settler": False, "is_scout": True},
            # 14. Theutates Thunder (light cavalry)
            {"name": "سوار زوبین‌انداز", "tribe": "GAUL", "attack_power": 90, "defense_infantry": 25, "defense_cavalry": 40,
             "speed": 19, "carry_capacity": 75, "wood_cost": 350, "clay_cost": 450, "iron_cost": 230, "crop_cost": 60,
             "crop_upkeep": 2, "base_train_time": 2480, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 15. Druidrider (defense cavalry)
            {"name": "سوار دروید", "tribe": "GAUL", "attack_power": 45, "defense_infantry": 115, "defense_cavalry": 55,
             "speed": 16, "carry_capacity": 0, "wood_cost": 500, "clay_cost": 350, "iron_cost": 360, "crop_cost": 100,
             "crop_upkeep": 4, "base_train_time": 2400, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 16. Haeduan (heavy cavalry)
            {"name": "سوار هیدوان", "tribe": "GAUL", "attack_power": 140, "defense_infantry": 50, "defense_cavalry": 165,
             "speed": 13, "carry_capacity": 0, "wood_cost": 700, "clay_cost": 200, "iron_cost": 420, "crop_cost": 100,
             "crop_upkeep": 4, "base_train_time": 3760, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 17. Battering Ram
            {"name": "قوچ گلی", "tribe": "GAUL", "attack_power": 50, "defense_infantry": 30, "defense_cavalry": 105,
             "speed": 4, "carry_capacity": 0, "wood_cost": 950, "clay_cost": 555, "iron_cost": 330, "crop_cost": 75,
             "crop_upkeep": 3, "base_train_time": 5000, "is_siege_weapon": True, "is_ram": True, "is_settler": False},
            # 18. Ballista (catapult)
            {"name": "بالیستا گلی", "tribe": "GAUL", "attack_power": 70, "defense_infantry": 45, "defense_cavalry": 10,
             "speed": 3, "carry_capacity": 0, "wood_cost": 960, "clay_cost": 1450, "iron_cost": 630, "crop_cost": 90,
             "crop_upkeep": 6, "base_train_time": 9000, "is_siege_weapon": True, "is_catapult": True, "is_settler": False},
            # 19. Chieftain (chief)
            {"name": "رئیس", "tribe": "GAUL", "attack_power": 40, "defense_infantry": 50, "defense_cavalry": 50,
             "speed": 4, "carry_capacity": 0, "wood_cost": 30750, "clay_cost": 45400, "iron_cost": 31000, "crop_cost": 37500,
             "crop_upkeep": 5, "base_train_time": 90700, "is_siege_weapon": False, "is_settler": False, "is_chief": True},
            # 20. Settler
            {"name": "مهاجر گلی", "tribe": "GAUL", "attack_power": 0, "defense_infantry": 80, "defense_cavalry": 80,
             "speed": 5, "carry_capacity": 3000, "wood_cost": 4400, "clay_cost": 4000, "iron_cost": 4600, "crop_cost": 5800,
             "crop_upkeep": 1, "base_train_time": 26900, "is_siege_weapon": False, "is_settler": True},
        ]

        # ═══════════════════════════════════════════════════════
        # TEUTON Troops (IDs 21-30) — Standard Travian Order
        # ═══════════════════════════════════════════════════════
        teuton_troops = [
            # 21. Clubswinger (basic infantry)
            {"name": "کلوب‌دار توتونی", "tribe": "TEUTON", "attack_power": 40, "defense_infantry": 20, "defense_cavalry": 5,
             "speed": 7, "carry_capacity": 60, "wood_cost": 95, "clay_cost": 75, "iron_cost": 40, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 720, "is_siege_weapon": False, "is_settler": False},
            # 22. Spearman (defense infantry)
            {"name": "نیزه‌دار توتونی", "tribe": "TEUTON", "attack_power": 10, "defense_infantry": 35, "defense_cavalry": 60,
             "speed": 7, "carry_capacity": 40, "wood_cost": 145, "clay_cost": 70, "iron_cost": 85, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1120, "is_siege_weapon": False, "is_settler": False},
            # 23. Axeman (offense infantry)
            {"name": "تبردار توتونی", "tribe": "TEUTON", "attack_power": 60, "defense_infantry": 30, "defense_cavalry": 30,
             "speed": 6, "carry_capacity": 45, "wood_cost": 120, "clay_cost": 130, "iron_cost": 185, "crop_cost": 60,
             "crop_upkeep": 1, "base_train_time": 1440, "is_siege_weapon": False, "is_settler": False},
            # 24. Scout
            {"name": "کاراگاه توتونی", "tribe": "TEUTON", "attack_power": 0, "defense_infantry": 10, "defense_cavalry": 5,
             "speed": 9, "carry_capacity": 0, "wood_cost": 160, "clay_cost": 100, "iron_cost": 50, "crop_cost": 50,
             "crop_upkeep": 1, "base_train_time": 1120, "is_siege_weapon": False, "is_settler": False, "is_scout": True},
            # 25. Paladin (light cavalry)
            {"name": "سوار پالادین", "tribe": "TEUTON", "attack_power": 55, "defense_infantry": 100, "defense_cavalry": 40,
             "speed": 10, "carry_capacity": 110, "wood_cost": 370, "clay_cost": 270, "iron_cost": 290, "crop_cost": 75,
             "crop_upkeep": 2, "base_train_time": 2400, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 26. Teutonic Knight (heavy cavalry)
            {"name": "شوالیه توتونی", "tribe": "TEUTON", "attack_power": 150, "defense_infantry": 50, "defense_cavalry": 75,
             "speed": 8, "carry_capacity": 80, "wood_cost": 500, "clay_cost": 350, "iron_cost": 400, "crop_cost": 100,
             "crop_upkeep": 4, "base_train_time": 4600, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 27. Battering Ram
            {"name": "قوچ توتونی", "tribe": "TEUTON", "attack_power": 65, "defense_infantry": 30, "defense_cavalry": 80,
             "speed": 4, "carry_capacity": 0, "wood_cost": 1000, "clay_cost": 300, "iron_cost": 350, "crop_cost": 70,
             "crop_upkeep": 3, "base_train_time": 4200, "is_siege_weapon": True, "is_ram": True, "is_settler": False},
            # 28. Catapult
            {"name": "کاتاپولت توتونی", "tribe": "TEUTON", "attack_power": 50, "defense_infantry": 60, "defense_cavalry": 10,
             "speed": 3, "carry_capacity": 0, "wood_cost": 900, "clay_cost": 1200, "iron_cost": 600, "crop_cost": 60,
             "crop_upkeep": 6, "base_train_time": 9000, "is_siege_weapon": True, "is_catapult": True, "is_settler": False},
            # 29. Chief
            {"name": "رئیس توتونی", "tribe": "TEUTON", "attack_power": 40, "defense_infantry": 60, "defense_cavalry": 40,
             "speed": 5, "carry_capacity": 0, "wood_cost": 35500, "clay_cost": 26600, "iron_cost": 25000, "crop_cost": 27200,
             "crop_upkeep": 5, "base_train_time": 70500, "is_siege_weapon": False, "is_settler": False, "is_chief": True},
            # 30. Settler
            {"name": "مهاجر توتونی", "tribe": "TEUTON", "attack_power": 0, "defense_infantry": 80, "defense_cavalry": 80,
             "speed": 5, "carry_capacity": 3000, "wood_cost": 7200, "clay_cost": 6500, "iron_cost": 5800, "crop_cost": 6500,
             "crop_upkeep": 1, "base_train_time": 31000, "is_siege_weapon": False, "is_settler": True},
        ]

        all_troops = roman_troops + gaul_troops + teuton_troops

        for data in all_troops:
            name = data.pop("name")
            tribe = data.pop("tribe")
            obj, created = TroopType.objects.update_or_create(
                name=name, tribe=tribe, defaults=data
            )
            status = "ساخته شد" if created else "آپدیت شد"
            self.stdout.write(self.style.SUCCESS(f"[{tribe}] id={obj.id} {obj.name}: {status}"))

        # ═══════════════════════════════════════════════════════
        # Academy Level Requirements
        # ═══════════════════════════════════════════════════════
        ACADEMY_REQUIREMENTS = {
            # ROMAN
            "محافظ نیزه‌دار": 1, "امپراتوری": 1, "کاراگاه": 1,
            "شوالیه سوار": 3, "سوار سناتور": 3,
            "قوچ آهنین": 5,
            "منجنیق": 10,
            "سناتور": 10,
            # GAUL
            "شمشیرزن گلی": 1, "ردیاب گلی": 1,
            "سوار زوبین‌انداز": 3, "سوار دروید": 3, "سوار هیدوان": 5,
            "قوچ گلی": 5,
            "بالیستا گلی": 10,
            "رئیس": 10,
            # TEUTON
            "نیزه‌دار توتونی": 1, "تبردار توتونی": 1, "کاراگاه توتونی": 1,
            "سوار پالادین": 3, "شوالیه توتونی": 5,
            "قوچ توتونی": 5,
            "کاتاپولت توتونی": 10,
            "رئیس توتونی": 10,
        }
        for troop_name, req_level in ACADEMY_REQUIREMENTS.items():
            updated = TroopType.objects.filter(name=troop_name).update(required_academy_level=req_level)
            if updated:
                self.stdout.write(self.style.SUCCESS(f"[Academy] {troop_name}: نیازمند آکادمی سطح {req_level}"))

        # ═══════════════════════════════════════════════════════
        # Animals
        # ═══════════════════════════════════════════════════════
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

        # ═══════════════════════════════════════════════════════
        # Hero Items
        # ═══════════════════════════════════════════════════════
        hero_item_defaults_list = [
            {"name": "کلاه‌خود آهنین", "item_type": "HELMET", "attack_bonus": 0, "defense_bonus": 20, "speed_bonus": 0},
            {"name": "زره فولادی", "item_type": "BODY", "attack_bonus": 0, "defense_bonus": 35, "speed_bonus": 0},
            {"name": "سپر بزرگ", "item_type": "SHIELD", "attack_bonus": 0, "defense_bonus": 25, "speed_bonus": 0},
            {"name": "شمشیر جنگی", "item_type": "LEFT_HAND", "attack_bonus": 50, "defense_bonus": 0, "speed_bonus": 0},
            {"name": "تبر جنگی", "item_type": "RIGHT_HAND", "attack_bonus": 40, "defense_bonus": 10, "speed_bonus": 0},
            {"name": "چکمه‌ی سبک", "item_type": "SHOES", "attack_bonus": 0, "defense_bonus": 5, "speed_bonus": 1},
            {"name": "اسب تندرو", "item_type": "HORSE", "attack_bonus": 0, "defense_bonus": 0, "speed_bonus": 2},
            {"name": "کلاه‌خود تجربه", "item_type": "HELMET", "experience_bonus_percent": 25},
            {"name": "کلاه‌خود جنگ‌آموز پیاده", "item_type": "HELMET", "infantry_training_speed_percent": 20},
            {"name": "کلاه‌خود جنگ‌آموز سوار", "item_type": "HELMET", "cavalry_training_speed_percent": 15},
            {"name": "شمشیر تهاجم پیاده", "item_type": "RIGHT_HAND", "infantry_attack_bonus_percent": 10},
            {"name": "شمشیر دفاع پیاده", "item_type": "LEFT_HAND", "infantry_defense_bonus_percent": 10},
            {"name": "نیزه تهاجم سوار", "item_type": "RIGHT_HAND", "cavalry_attack_bonus_percent": 10},
            {"name": "نیزه دفاع سوار", "item_type": "LEFT_HAND", "cavalry_defense_bonus_percent": 10},
        ]
        for data in hero_item_defaults_list:
            name = data.pop("name")
            obj, created = HeroItem.objects.update_or_create(name=name, defaults=data)
            status = "ساخته شد" if created else "از قبل وجود داشت"
            self.stdout.write(self.style.SUCCESS(f"[HeroItem] {obj.id} - {obj.name}: {status}"))
