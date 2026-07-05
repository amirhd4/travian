from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    name = "apps.authentication"

    def ready(self):
        from . import signals  # noqa: F401  (فقط برای اتصال سیگنال import می‌شود)