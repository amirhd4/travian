from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class UsernameOrEmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            return None

        try:
            # جستجوی همزمان با یک کوئری در دیتابیس برای پرفورمنس بهتر
            user = User.objects.get(Q(username=username) | Q(email=username))
        except User.DoesNotExist:
            return None
        except User.MultipleObjectsReturned:
            # برای جلوگیری از کرش کردن در مواقعی که دیتابیس دچار تداخل داده شده است
            user = User.objects.filter(Q(username=username) | Q(email=username)).first()

        # بررسی صحت پسورد و مسدود نبودن اکانت (is_active)
        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None