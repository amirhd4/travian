from django.core.management.base import BaseCommand
from apps.game_engine.models import QuestDefinition


class Command(BaseCommand):
    help = "کوئست‌های آموزشی استاندارد را می‌سازد یا به‌روزرسانی می‌کند."

    def handle(self, *args, **options):
        quest_defaults_list = [
            {
                "order": 1, "title": "ارتقای ساختمان اصلی",
                "description": "ساختمان اصلی دهکده‌ی خود را به سطح ۳ ارتقا دهید.",
                "condition_type": "MAIN_BUILDING_LEVEL", "condition_target": 3,
                "reward_wood": 150, "reward_clay": 150, "reward_iron": 100, "reward_crop": 100,
            },
            {
                "order": 2, "title": "توسعه‌ی مزارع منابع",
                "description": "حداقل یکی از مزارع منابع (چوب‌بری، گودال خاک رس، معدن آهن یا مزرعه گندم) را به سطح ۲ برسانید.",
                "condition_type": "RESOURCE_FIELD_LEVEL", "condition_target": 2,
                "reward_wood": 100, "reward_clay": 100, "reward_iron": 100, "reward_crop": 100,
            },
            {
                "order": 3, "title": "ساخت انبار",
                "description": "یک انبار برای ذخیره‌ی بهتر چوب/خشت/آهن بسازید.",
                "condition_type": "WAREHOUSE_LEVEL", "condition_target": 1,
                "reward_wood": 100, "reward_clay": 50, "reward_iron": 50, "reward_crop": 0,
            },
            {
                "order": 4, "title": "ساخت سیلوی غله",
                "description": "یک سیلوی غله برای ذخیره‌ی بهتر گندم بسازید.",
                "condition_type": "GRANARY_LEVEL", "condition_target": 1,
                "reward_wood": 50, "reward_clay": 50, "reward_iron": 50, "reward_crop": 150,
            },
            {
                "order": 5, "title": "ساخت محل گردهمایی",
                "description": "محل گردهمایی (Rally Point) را بسازید تا بتوانید نیرو اعزام کنید.",
                "condition_type": "RALLY_POINT_LEVEL", "condition_target": 1,
                "reward_wood": 150, "reward_clay": 100, "reward_iron": 100, "reward_crop": 50,
            },
            {
                "order": 6, "title": "ساخت پادگان",
                "description": "یک پادگان بسازید تا بتوانید نیروی نظامی آموزش دهید.",
                "condition_type": "BARRACKS_LEVEL", "condition_target": 1,
                "reward_wood": 200, "reward_clay": 150, "reward_iron": 150, "reward_crop": 100,
            },
            {
                "order": 7, "title": "آموزش اولین نیروها",
                "description": "حداقل ۱۰ نیروی نظامی (از هر نوعی) آموزش دهید.",
                "condition_type": "TROOP_COUNT", "condition_target": 10,
                "reward_wood": 100, "reward_clay": 100, "reward_iron": 150, "reward_crop": 100,
            },
            {
                "order": 8, "title": "ساخت بازارچه",
                "description": "یک بازارچه بسازید تا بتوانید با دیگر دهکده‌ها تجارت کنید.",
                "condition_type": "MARKETPLACE_LEVEL", "condition_target": 1,
                "reward_wood": 150, "reward_clay": 150, "reward_iron": 100, "reward_crop": 100,
            },
            {
                "order": 9, "title": "اولین محموله‌ی تجاری",
                "description": "حداقل یک محموله‌ی منابع از طریق بازارچه ارسال کنید.",
                "condition_type": "TRADE_SENT", "condition_target": 1,
                "reward_wood": 100, "reward_clay": 100, "reward_iron": 100, "reward_crop": 100,
            },
            {
                "order": 10, "title": "اولین ماموریت نظامی",
                "description": "حداقل یک نیرو (حمله، غارت یا شناسایی) به دهکده‌ی دیگری اعزام کنید.",
                "condition_type": "MOVEMENT_SENT", "condition_target": 1,
                "reward_wood": 150, "reward_clay": 100, "reward_iron": 150, "reward_crop": 100,
            },
            {
                "order": 11, "title": "تقویت دفاع",
                "description": "دیوار دهکده‌ی خود را حداقل به سطح ۱ ارتقا دهید.",
                "condition_type": "WALL_LEVEL", "condition_target": 1,
                "reward_wood": 100, "reward_clay": 150, "reward_iron": 100, "reward_crop": 50,
            },
            {
                "order": 12, "title": "اولین ماجراجویی قهرمان",
                "description": "قهرمان خود را حداقل یک‌بار به ماجراجویی اعزام کنید.",
                "condition_type": "HERO_ADVENTURE", "condition_target": 1,
                "reward_wood": 100, "reward_clay": 100, "reward_iron": 100, "reward_crop": 100, "reward_gold": 2,
            },
            {
                "order": 13, "title": "تاسیس دومین دهکده",
                "description": "با استفاده از ۳ نیروی مهاجر، دومین دهکده‌ی خود را تاسیس کنید.",
                "condition_type": "SECOND_VILLAGE", "condition_target": 2,
                "reward_wood": 300, "reward_clay": 300, "reward_iron": 300, "reward_crop": 300, "reward_gold": 5,
            },
        ]

        for data in quest_defaults_list:
            order = data.pop("order")
            obj, created = QuestDefinition.objects.update_or_create(order=order, defaults=data)
            status = "ساخته شد" if created else "به‌روزرسانی شد"
            self.stdout.write(self.style.SUCCESS(f"[Quest] #{obj.order} - {obj.title}: {status}"))