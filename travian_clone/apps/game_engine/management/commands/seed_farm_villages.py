from django.core.management.base import BaseCommand
from apps.game_engine.farm_villages import spawn_farm_villages


class Command(BaseCommand):
    help = "دهکده‌های فارم را طبق تنظیمات ServerSetting فعال می‌سازد."

    def handle(self, *args, **options):
        spawn_farm_villages()
        self.stdout.write(self.style.SUCCESS("دهکده‌های فارم ساخته شدند."))