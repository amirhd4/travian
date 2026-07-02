from django.db import models
from django.contrib.auth.models import AbstractUser

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
    has_ww_plan = models.BooleanField(default=False)

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