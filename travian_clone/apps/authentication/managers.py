from django.contrib.auth.base_user import BaseUserManager


class PlayerManager(BaseUserManager):

    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError("ایمیل برای ایجاد کاربر الزامی است.")
        if not username:
            raise ValueError("نام کاربری برای ایجاد کاربر الزامی است.")

        # starting_quadrant فیلد واقعی مدل Player نیست؛ فقط برای انتقال
        # ترجیح «محل شروع» به سیگنال ساخت دهکده‌ی اول به‌صورت موقت روی
        # نمونه نگه داشته می‌شود.
        starting_quadrant = extra_fields.pop('starting_quadrant', 'RANDOM')

        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)

        user.set_password(password)
        user._starting_quadrant = starting_quadrant
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser باید دارای is_staff=True باشد.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser باید دارای is_superuser=True باشد.")

        return self.create_user(username, email, password, **extra_fields)