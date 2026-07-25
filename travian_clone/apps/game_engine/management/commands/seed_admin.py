from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

Player = get_user_model()

ADMIN_USERNAME = "majditravian"
ADMIN_EMAIL = "admin@travian.ir"
ADMIN_PASSWORD = "admin123"


class Command(BaseCommand):
    help = "حساب ادمین پیش‌فرض بازی (majditravian) را می‌سازد یا به‌روزرسانی می‌کند."

    def handle(self, *args, **options):
        player, created = Player.objects.get_or_create(
            username=ADMIN_USERNAME,
            defaults={
                "email": ADMIN_EMAIL,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        if created:
            player.set_password(ADMIN_PASSWORD)
            player.save()
            self.stdout.write(self.style.SUCCESS(
                f"Admin account '{ADMIN_USERNAME}' created successfully.\n"
                f"  Username: {ADMIN_USERNAME}\n"
                f"  Password: {ADMIN_PASSWORD}\n"
                f"  IMPORTANT: Change the password after first login!"
            ))
        else:
            updated = False
            for attr in ("is_staff", "is_superuser", "is_active"):
                if not getattr(player, attr):
                    setattr(player, attr, True)
                    updated = True
            if updated:
                player.save()
            self.stdout.write(self.style.WARNING(
                f"Admin account '{ADMIN_USERNAME}' already exists."
            ))
