from django.contrib.auth.models import AbstractUser
from django.db import models


class Player(AbstractUser):
    # فیلد username را غیرفعال یا اختیاری می‌کنیم
    username = models.CharField(max_length=50, unique=True, null=True, blank=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)

    # سایر فیلدهای بازی
    tribe = models.CharField(max_length=10, choices=[('ROMAN', 'Roman'), ('TEUTON', 'Teuton'), ('GAUL', 'Gaul')],
                             default='ROMAN')
    gold_coins = models.PositiveIntegerField(default=0)
    has_ww_plan = models.BooleanField(default=False)
    alliance_id = models.IntegerField(null=True, blank=True)

    # تنظیم فیلد اصلی احراز هویت به ایمیل
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email or self.phone_number