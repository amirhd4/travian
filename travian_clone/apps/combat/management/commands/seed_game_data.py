from django.core.management.base import BaseCommand

from apps.combat.models import TroopType, Animal, HeroItem


class Command(BaseCommand):
    help = "ایجاد دیتای پایه نیروها با آمار صحیح تراوین اصلی (۱۰ نیرو برای هر قبیله)."

    def handle(self, *args, **options):
        # ═══════════════════════════════════════════════════════
        # Cleanup old orphan records before re-seeding
        # ═══════════════════════════════════════════════════════
        TroopType.objects.filter(tribe__in=['ROMAN', 'GAUL', 'TEUTON']).delete()

        # ═══════════════════════════════════════════════════════
        # ROMAN Troops (IDs 1-10) — Travian fa.php names + unitdata.php stats
        # ═══════════════════════════════════════════════════════
        roman_troops = [
            # 1. سرباز لژیون (basic infantry, no research)
            {"id": 1, "name": "سرباز لژیون", "tribe": "ROMAN", "attack_power": 40, "defense_infantry": 35, "defense_cavalry": 50,
             "speed": 6, "carry_capacity": 50, "wood_cost": 120, "clay_cost": 100, "iron_cost": 150, "crop_cost": 30,
             "crop_upkeep": 1, "base_train_time": 1600, "is_siege_weapon": False, "is_settler": False},
            # 2. محافظ (Praetorian)
            {"id": 2, "name": "محافظ", "tribe": "ROMAN", "attack_power": 30, "defense_infantry": 65, "defense_cavalry": 35,
             "speed": 5, "carry_capacity": 20, "wood_cost": 100, "clay_cost": 130, "iron_cost": 160, "crop_cost": 70,
             "crop_upkeep": 1, "base_train_time": 1760, "is_siege_weapon": False, "is_settler": False},
            # 3. شمشیرزن (Imperian)
            {"id": 3, "name": "شمشیرزن", "tribe": "ROMAN", "attack_power": 70, "defense_infantry": 40, "defense_cavalry": 25,
             "speed": 7, "carry_capacity": 50, "wood_cost": 150, "clay_cost": 160, "iron_cost": 210, "crop_cost": 80,
             "crop_upkeep": 1, "base_train_time": 1920, "is_siege_weapon": False, "is_settler": False},
            # 4. خبرچین (Scout)
            {"id": 4, "name": "خبرچین", "tribe": "ROMAN", "attack_power": 0, "defense_infantry": 20, "defense_cavalry": 10,
             "speed": 16, "carry_capacity": 0, "wood_cost": 140, "clay_cost": 160, "iron_cost": 20, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1360, "is_siege_weapon": False, "is_settler": False, "is_scout": True},
            # 5. شوالیه (Equites Imperatoris)
            {"id": 5, "name": "شوالیه", "tribe": "ROMAN", "attack_power": 120, "defense_infantry": 65, "defense_cavalry": 50,
             "speed": 14, "carry_capacity": 100, "wood_cost": 550, "clay_cost": 440, "iron_cost": 320, "crop_cost": 100,
             "crop_upkeep": 3, "base_train_time": 2640, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 6. شوالیه سزار (Equites Caesaris)
            {"id": 6, "name": "شوالیه سزار", "tribe": "ROMAN", "attack_power": 180, "defense_infantry": 80, "defense_cavalry": 105,
             "speed": 10, "carry_capacity": 70, "wood_cost": 550, "clay_cost": 640, "iron_cost": 800, "crop_cost": 180,
             "crop_upkeep": 4, "base_train_time": 3520, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 7. دژکوب (Battering Ram)
            {"id": 7, "name": "دژکوب", "tribe": "ROMAN", "attack_power": 60, "defense_infantry": 30, "defense_cavalry": 75,
             "speed": 4, "carry_capacity": 0, "wood_cost": 900, "clay_cost": 360, "iron_cost": 500, "crop_cost": 70,
             "crop_upkeep": 3, "base_train_time": 4600, "is_siege_weapon": True, "is_ram": True, "is_settler": False},
            # 8. منجنیق آتشین (Fire Catapult)
            {"id": 8, "name": "منجنیق آتشین", "tribe": "ROMAN", "attack_power": 75, "defense_infantry": 60, "defense_cavalry": 10,
             "speed": 3, "carry_capacity": 0, "wood_cost": 950, "clay_cost": 1350, "iron_cost": 600, "crop_cost": 90,
             "crop_upkeep": 6, "base_train_time": 9000, "is_siege_weapon": True, "is_catapult": True, "is_settler": False},
            # 9. سناتور (Senator)
            {"id": 9, "name": "سناتور", "tribe": "ROMAN", "attack_power": 50, "defense_infantry": 40, "defense_cavalry": 30,
             "speed": 5, "carry_capacity": 0, "wood_cost": 30750, "clay_cost": 27200, "iron_cost": 45000, "crop_cost": 37500,
             "crop_upkeep": 5, "base_train_time": 90700, "is_siege_weapon": False, "is_settler": False, "is_chief": True},
            # 10. مهاجر (Settler)
            {"id": 10, "name": "مهاجر", "tribe": "ROMAN", "attack_power": 0, "defense_infantry": 80, "defense_cavalry": 80,
             "speed": 5, "carry_capacity": 3000, "wood_cost": 5800, "clay_cost": 5300, "iron_cost": 7200, "crop_cost": 5500,
             "crop_upkeep": 1, "base_train_time": 26900, "is_siege_weapon": False, "is_settler": True},
        ]

        # ═══════════════════════════════════════════════════════
        # GAUL Troops (IDs 11-20) — Travian fa.php names + unitdata.php stats
        # ═══════════════════════════════════════════════════════
        gaul_troops = [
            # 11. سرباز پیاده (basic infantry, no research)
            {"id": 11, "name": "سرباز پیاده", "tribe": "GAUL", "attack_power": 15, "defense_infantry": 40, "defense_cavalry": 50,
             "speed": 7, "carry_capacity": 35, "wood_cost": 100, "clay_cost": 130, "iron_cost": 55, "crop_cost": 30,
             "crop_upkeep": 1, "base_train_time": 1040, "is_siege_weapon": False, "is_settler": False},
            # 12. شمشیرزن (Swordsman)
            {"id": 12, "name": "شمشیرزن", "tribe": "GAUL", "attack_power": 65, "defense_infantry": 35, "defense_cavalry": 20,
             "speed": 6, "carry_capacity": 45, "wood_cost": 140, "clay_cost": 150, "iron_cost": 185, "crop_cost": 60,
             "crop_upkeep": 1, "base_train_time": 1440, "is_siege_weapon": False, "is_settler": False},
            # 13. ردياب (Pathfinder)
            {"id": 13, "name": "ردياب", "tribe": "GAUL", "attack_power": 0, "defense_infantry": 20, "defense_cavalry": 10,
             "speed": 17, "carry_capacity": 0, "wood_cost": 170, "clay_cost": 150, "iron_cost": 20, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1360, "is_siege_weapon": False, "is_settler": False, "is_scout": True},
            # 14. رعد (Theutates Thunder)
            {"id": 14, "name": "رعد", "tribe": "GAUL", "attack_power": 90, "defense_infantry": 25, "defense_cavalry": 40,
             "speed": 19, "carry_capacity": 75, "wood_cost": 350, "clay_cost": 450, "iron_cost": 230, "crop_cost": 60,
             "crop_upkeep": 2, "base_train_time": 2480, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 15. کاهن سواره (Druidrider)
            {"id": 15, "name": "کاهن سواره", "tribe": "GAUL", "attack_power": 45, "defense_infantry": 115, "defense_cavalry": 55,
             "speed": 16, "carry_capacity": 35, "wood_cost": 360, "clay_cost": 330, "iron_cost": 280, "crop_cost": 120,
             "crop_upkeep": 2, "base_train_time": 2560, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 16. شوالیه گول (Haeduan)
            {"id": 16, "name": "شوالیه گول", "tribe": "GAUL", "attack_power": 140, "defense_infantry": 50, "defense_cavalry": 165,
             "speed": 13, "carry_capacity": 65, "wood_cost": 500, "clay_cost": 620, "iron_cost": 675, "crop_cost": 170,
             "crop_upkeep": 3, "base_train_time": 3120, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 17. دژکوب (Battering Ram)
            {"id": 17, "name": "دژکوب", "tribe": "GAUL", "attack_power": 50, "defense_infantry": 30, "defense_cavalry": 105,
             "speed": 4, "carry_capacity": 0, "wood_cost": 950, "clay_cost": 555, "iron_cost": 330, "crop_cost": 75,
             "crop_upkeep": 3, "base_train_time": 5000, "is_siege_weapon": True, "is_ram": True, "is_settler": False},
            # 18. منجنیق (Catapult)
            {"id": 18, "name": "منجنیق", "tribe": "GAUL", "attack_power": 70, "defense_infantry": 45, "defense_cavalry": 10,
             "speed": 3, "carry_capacity": 0, "wood_cost": 960, "clay_cost": 1450, "iron_cost": 630, "crop_cost": 90,
             "crop_upkeep": 6, "base_train_time": 9000, "is_siege_weapon": True, "is_catapult": True, "is_settler": False},
            # 19. رئیس قبیله (Chieftain)
            {"id": 19, "name": "رئیس قبیله", "tribe": "GAUL", "attack_power": 40, "defense_infantry": 50, "defense_cavalry": 50,
             "speed": 4, "carry_capacity": 0, "wood_cost": 30750, "clay_cost": 45400, "iron_cost": 31000, "crop_cost": 37500,
             "crop_upkeep": 5, "base_train_time": 90700, "is_siege_weapon": False, "is_settler": False, "is_chief": True},
            # 20. مهاجر (Settler)
            {"id": 20, "name": "مهاجر", "tribe": "GAUL", "attack_power": 0, "defense_infantry": 80, "defense_cavalry": 80,
             "speed": 5, "carry_capacity": 3000, "wood_cost": 5500, "clay_cost": 7000, "iron_cost": 5300, "crop_cost": 4900,
             "crop_upkeep": 1, "base_train_time": 22700, "is_siege_weapon": False, "is_settler": True},
        ]

        # ═══════════════════════════════════════════════════════
        # TEUTON Troops (IDs 21-30) — Travian fa.php names + unitdata.php stats
        # ═══════════════════════════════════════════════════════
        teuton_troops = [
            # 21. گرزدار (basic infantry, no research)
            {"id": 21, "name": "گرزدار", "tribe": "TEUTON", "attack_power": 40, "defense_infantry": 20, "defense_cavalry": 5,
             "speed": 7, "carry_capacity": 60, "wood_cost": 95, "clay_cost": 75, "iron_cost": 40, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 720, "is_siege_weapon": False, "is_settler": False},
            # 22. نیزه دار (Spearman)
            {"id": 22, "name": "نیزه دار", "tribe": "TEUTON", "attack_power": 10, "defense_infantry": 35, "defense_cavalry": 60,
             "speed": 7, "carry_capacity": 40, "wood_cost": 145, "clay_cost": 70, "iron_cost": 85, "crop_cost": 40,
             "crop_upkeep": 1, "base_train_time": 1120, "is_siege_weapon": False, "is_settler": False},
            # 23. تبرزن (Axeman)
            {"id": 23, "name": "تبرزن", "tribe": "TEUTON", "attack_power": 60, "defense_infantry": 30, "defense_cavalry": 30,
             "speed": 6, "carry_capacity": 50, "wood_cost": 130, "clay_cost": 120, "iron_cost": 170, "crop_cost": 70,
             "crop_upkeep": 1, "base_train_time": 1200, "is_siege_weapon": False, "is_settler": False},
            # 24. جاسوس (Scout)
            {"id": 24, "name": "جاسوس", "tribe": "TEUTON", "attack_power": 0, "defense_infantry": 10, "defense_cavalry": 5,
             "speed": 9, "carry_capacity": 0, "wood_cost": 160, "clay_cost": 100, "iron_cost": 50, "crop_cost": 50,
             "crop_upkeep": 1, "base_train_time": 1120, "is_siege_weapon": False, "is_settler": False, "is_scout": True},
            # 25. دلاور (Paladin)
            {"id": 25, "name": "دلاور", "tribe": "TEUTON", "attack_power": 55, "defense_infantry": 100, "defense_cavalry": 40,
             "speed": 10, "carry_capacity": 110, "wood_cost": 370, "clay_cost": 270, "iron_cost": 290, "crop_cost": 75,
             "crop_upkeep": 2, "base_train_time": 2400, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 26. شوالیه توتن (Teutonic Knight)
            {"id": 26, "name": "شوالیه توتن", "tribe": "TEUTON", "attack_power": 150, "defense_infantry": 50, "defense_cavalry": 75,
             "speed": 9, "carry_capacity": 80, "wood_cost": 450, "clay_cost": 515, "iron_cost": 480, "crop_cost": 80,
             "crop_upkeep": 3, "base_train_time": 2960, "is_siege_weapon": False, "is_settler": False, "is_cavalry": True},
            # 27. دژکوب (Battering Ram)
            {"id": 27, "name": "دژکوب", "tribe": "TEUTON", "attack_power": 65, "defense_infantry": 30, "defense_cavalry": 80,
             "speed": 4, "carry_capacity": 0, "wood_cost": 1000, "clay_cost": 300, "iron_cost": 350, "crop_cost": 70,
             "crop_upkeep": 3, "base_train_time": 4200, "is_siege_weapon": True, "is_ram": True, "is_settler": False},
            # 28. منجنیق (Catapult)
            {"id": 28, "name": "منجنیق", "tribe": "TEUTON", "attack_power": 50, "defense_infantry": 60, "defense_cavalry": 10,
             "speed": 3, "carry_capacity": 0, "wood_cost": 900, "clay_cost": 1200, "iron_cost": 600, "crop_cost": 60,
             "crop_upkeep": 6, "base_train_time": 9000, "is_siege_weapon": True, "is_catapult": True, "is_settler": False},
            # 29. رئیس (Chief)
            {"id": 29, "name": "رئیس", "tribe": "TEUTON", "attack_power": 40, "defense_infantry": 60, "defense_cavalry": 40,
             "speed": 5, "carry_capacity": 0, "wood_cost": 35500, "clay_cost": 26600, "iron_cost": 25000, "crop_cost": 27200,
             "crop_upkeep": 4, "base_train_time": 70500, "is_siege_weapon": False, "is_settler": False, "is_chief": True},
            # 30. مهاجر (Settler)
            {"id": 30, "name": "مهاجر", "tribe": "TEUTON", "attack_power": 10, "defense_infantry": 80, "defense_cavalry": 80,
             "speed": 5, "carry_capacity": 3000, "wood_cost": 7200, "clay_cost": 5500, "iron_cost": 5800, "crop_cost": 6500,
             "crop_upkeep": 1, "base_train_time": 31000, "is_siege_weapon": False, "is_settler": True},
        ]

        all_troops = roman_troops + gaul_troops + teuton_troops

        for data in all_troops:
            troop_id = data["id"]
            tribe = data["tribe"]
            obj, created = TroopType.objects.update_or_create(
                id=troop_id, tribe=tribe, defaults=data
            )
            status = "ساخته شد" if created else "آپدیت شد"
            self.stdout.write(self.style.SUCCESS(f"[{tribe}] id={obj.id} {obj.name}: {status}"))

        # ═══════════════════════════════════════════════════════
        # Academy Level Requirements
        # ═══════════════════════════════════════════════════════
        ACADEMY_REQUIREMENTS = {
            # ROMAN
            "محافظ": 1, "شمشیرزن": 1, "خبرچین": 1,
            "شوالیه": 3, "شوالیه سزار": 3,
            "دژکوب": 5,
            "منجنیق آتشین": 10,
            "سناتور": 10,
            # GAUL
            "شمشیرزن": 1, "ردياب": 1,
            "رعد": 3, "کاهن سواره": 3, "شوالیه گول": 5,
            "دژکوب": 5,
            "منجنیق": 10,
            "رئیس قبیله": 10,
            # TEUTON
            "نیزه دار": 1, "تبرزن": 1, "جاسوس": 1,
            "دلاور": 3, "شوالیه توتن": 5,
            "دژکوب": 5,
            "منجنیق": 10,
            "رئیس": 10,
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
