from django.core.management.base import BaseCommand
from apps.game_engine.models import GoldPackage


class Command(BaseCommand):
    help = "بسته‌های استاندارد خرید طلا را می‌سازد."

    def handle(self, *args, **options):
        packages = [
            {"name": "بسته کوچک", "gold_amount": 50, "price": 50000},
            {"name": "بسته متوسط", "gold_amount": 150, "price": 130000},
            {"name": "بسته بزرگ", "gold_amount": 500, "price": 400000},
            {"name": "بسته ویژه", "gold_amount": 1200, "price": 850000},
        ]
        for data in packages:
            name = data.pop("name")
            obj, created = GoldPackage.objects.update_or_create(name=name, defaults=data)
            status = "ساخته شد" if created else "به‌روزرسانی شد"
            self.stdout.write(self.style.SUCCESS(f"[GoldPackage] {obj.name}: {status}"))