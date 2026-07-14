from django.db import models
from django.contrib.auth.models import AbstractUser

from django.utils import timezone

from .managers import PlayerManager


class Player(AbstractUser):
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        blank=True,
        null=True
    )

    tribe = models.CharField(
        max_length=10,
        choices=[
            ("ROMAN", "Roman"),
            ("TEUTON", "Teuton"),
            ("GAUL", "Gaul"),
        ],
        default="ROMAN",
    )

    gold_coins = models.PositiveIntegerField(default=0)
    silver_coins = models.PositiveIntegerField(default=0)
    # has_ww_plan = models.BooleanField(default=False)
    has_plus = models.BooleanField(default=False)
    plus_expires_at = models.DateTimeField(blank=True, null=True)
    has_gold_club = models.BooleanField(default=False)
    has_attacked = models.BooleanField(default=False)
    culture_points = models.FloatField(default=0)

    def has_plus_active(self):
        return bool(self.has_plus and self.plus_expires_at and self.plus_expires_at > timezone.now())

    alliance_id = models.IntegerField(
        blank=True,
        null=True
    )

    email = models.EmailField(unique=True)

    username = models.CharField(
        max_length=50,
        unique=True
    )

    USERNAME_FIELD = "username"

    # ایمیل را به فیلدهای الزامی اضافه می‌کنیم تا در خط فرمان از ما پرسیده شود
    REQUIRED_FIELDS = ["email"]

    objects = PlayerManager()

    def __str__(self):
        return self.username