import random
from django.core.management.base import BaseCommand
from apps.game_engine.models import Oasis, Village

RESOURCE_CHOICES = ['wood', 'clay', 'iron', 'crop']


class Command(BaseCommand):
    help = "تعدادی اوسیس آزاد روی نقشه پخش می‌کند."

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=40)

    def handle(self, *args, **options):
        count = options['count']
        created = 0
        for _ in range(count):
            for _ in range(500):
                x = random.randint(-200, 200)
                y = random.randint(-200, 200)
                if Village.objects.filter(x_coord=x, y_coord=y).exists():
                    continue
                if Oasis.objects.filter(x_coord=x, y_coord=y).exists():
                    continue
                Oasis.objects.create(
                    x_coord=x, y_coord=y,
                    bonus_resource=random.choice(RESOURCE_CHOICES),
                    bonus_percent=random.choice([25, 25, 25, 50]),
                    defense_strength=random.randint(50, 400),
                )
                created += 1
                break
        self.stdout.write(self.style.SUCCESS(f"{created} اوسیس ساخته شد."))