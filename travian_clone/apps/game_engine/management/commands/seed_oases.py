import random
from django.core.management.base import BaseCommand
from apps.game_engine.models import Oasis, Village, OASIS_DEFENSE_RANGES

# Weighted distribution matching PHP Travian (oasis_type → weight)
OASIS_TYPE_WEIGHTS = {
    1: 16,   # Wood 25%
    3: 8,    # Wood 25% + Crop 25%
    4: 16,   # Clay 25%
    6: 8,    # Clay 25% + Crop 25%
    7: 16,   # Iron 25%
    9: 8,    # Iron 25% + Crop 25%
    10: 8,   # Crop 25%
    11: 8,   # Crop 25%
    12: 12,  # Crop 50%
}
OASIS_TYPES = list(OASIS_TYPE_WEIGHTS.keys())
OASIS_WEIGHTS = list(OASIS_TYPE_WEIGHTS.values())

NATARS_MAX_DISTANCE = 10


class Command(BaseCommand):
    help = "ایجاد آبادی ها روی نقشه با توزیع استاندارد تراوین"

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=None, help='تعداد کل آبادی ها (پیش‌فرض: 10%% نقشه)')
        parser.add_argument('--density', type=float, default=0.10, help='تراکم آبادی (پیش‌فرض: 0.10 = 10%%)')
        parser.add_argument('--clear', action='store_true', help='پاک کردن آبادی های موجود')
        parser.add_argument('--radius', type=int, default=250, help='شعاع نقشه (پیش‌فرض: 250)')

    def handle(self, *args, **options):
        radius = options['radius']
        density = options['density']
        count = options['count']

        if options['clear']:
            Oasis.objects.all().delete()
            self.stdout.write("آبادی های موجود پاک شدند.")

        # Collect existing village/oasis coordinates
        existing_coords = set(
            Village.objects.values_list('x_coord', 'y_coord', named=True)
        ) | set(
            Oasis.objects.values_list('x_coord', 'y_coord', named=True)
        )

        # Determine target count
        total_tiles = (2 * radius + 1) ** 2
        if count is None:
            count = int(total_tiles * density)
        self.stdout.write(f"هدف: {count} آبادی در نقشه {2*radius+1}x{2*radius+1}")

        batch = []
        created = 0
        attempts = 0
        max_attempts = count * 20

        while created < count and attempts < max_attempts:
            attempts += 1
            x = random.randint(-radius, radius)
            y = random.randint(-radius, radius)

            # Skip Natars territory
            if abs(x) <= NATARS_MAX_DISTANCE and abs(y) <= NATARS_MAX_DISTANCE:
                continue

            # Skip existing
            if (x, y) in existing_coords:
                continue

            oasis_type = random.choices(OASIS_TYPES, weights=OASIS_WEIGHTS, k=1)[0]
            defense_min, defense_max = OASIS_DEFENSE_RANGES.get(oasis_type, (50, 150))

            batch.append(Oasis(
                x_coord=x, y_coord=y,
                oasis_type=oasis_type,
                defense_strength=random.randint(defense_min, defense_max),
            ))
            existing_coords.add((x, y))
            created += 1

            if len(batch) >= 1000:
                Oasis.objects.bulk_create(batch, ignore_conflicts=True)
                batch = []

        if batch:
            Oasis.objects.bulk_create(batch, ignore_conflicts=True)

        self.stdout.write(self.style.SUCCESS(f"{created} آبادی ساخته شد."))
