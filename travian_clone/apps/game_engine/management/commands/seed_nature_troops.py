import random
from django.core.management.base import BaseCommand
from apps.game_engine.models import NatureTroopType, Oasis, OasisTroop, OASIS_DEFENSE_RANGES


NATURE_TROOP_DATA = [
    {"unit_id": 31, "name": "Scorpion", "name_fa": "عقرب", "attack": 10, "defense_infantry": 25, "defense_cavalry": 20, "speed": 7},
    {"unit_id": 32, "name": "Spider", "name_fa": "عنکبوت", "attack": 15, "defense_infantry": 20, "defense_cavalry": 15, "speed": 7},
    {"unit_id": 33, "name": "Snake", "name_fa": "مار", "attack": 10, "defense_infantry": 15, "defense_cavalry": 10, "speed": 7},
    {"unit_id": 34, "name": "Centipede", "name_fa": "هزارپا", "attack": 20, "defense_infantry": 15, "defense_cavalry": 10, "speed": 7},
    {"unit_id": 35, "name": "Boar", "name_fa": "گراز وحشی", "attack": 40, "defense_infantry": 50, "defense_cavalry": 30, "speed": 7},
    {"unit_id": 36, "name": "Wolf", "name_fa": "گرگ", "attack": 50, "defense_infantry": 30, "defense_cavalry": 50, "speed": 7},
    {"unit_id": 37, "name": "Bear", "name_fa": "خرس", "attack": 80, "defense_infantry": 120, "defense_cavalry": 60, "speed": 7},
    {"unit_id": 38, "name": "Crocodile", "name_fa": "تمساح", "attack": 100, "defense_infantry": 80, "defense_cavalry": 100, "speed": 7},
    {"unit_id": 39, "name": "Tiger", "name_fa": "ببر", "attack": 120, "defense_infantry": 100, "defense_cavalry": 140, "speed": 7},
    {"unit_id": 40, "name": "Elephant", "name_fa": "فیل", "attack": 200, "defense_infantry": 150, "defense_cavalry": 200, "speed": 7},
]

# Oasis type → list of (unit_id, min_count, max_count) for nature troop spawning
OASIS_TROOP_SPAWN = {
    1:  [(35, 5, 30), (36, 5, 30), (37, 0, 30)],
    2:  [(35, 10, 40), (36, 10, 40), (37, 5, 35)],
    3:  [(35, 5, 30), (36, 5, 30), (37, 0, 30), (39, 0, 10), (40, 0, 1)],
    4:  [(31, 5, 40), (32, 5, 30), (35, 0, 25)],
    5:  [(31, 10, 50), (32, 10, 40), (35, 5, 30)],
    6:  [(31, 5, 40), (32, 5, 30), (35, 0, 25), (38, 0, 15), (40, 0, 1)],
    7:  [(31, 5, 40), (32, 5, 30), (34, 0, 25)],
    8:  [(31, 10, 50), (32, 10, 40), (34, 5, 30)],
    9:  [(31, 5, 40), (32, 5, 30), (34, 0, 25), (37, 0, 15), (40, 0, 1)],
    10: [(31, 5, 40), (33, 5, 30), (37, 1, 25), (39, 0, 25)],
    11: [(31, 5, 40), (33, 5, 30), (37, 1, 25), (39, 0, 25)],
    12: [(31, 5, 40), (33, 5, 30), (38, 1, 25), (39, 0, 25), (40, 0, 1)],
}


class Command(BaseCommand):
    help = "ایجاد انواع نیروی طبیعت و اسپاون نیرو در آبادی ها"

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='پاک کردن نیروهای موجود قبل از اسپاون')

    def handle(self, *args, **options):
        # Create NatureTroopType records
        created_count = 0
        for data in NATURE_TROOP_DATA:
            obj, created = NatureTroopType.objects.update_or_create(
                unit_id=data['unit_id'],
                defaults=data,
            )
            if created:
                created_count += 1
        self.stdout.write(self.style.SUCCESS(f"{created_count} نوع نیروی طبیعت ایجاد شد."))

        troop_map = {t.unit_id: t for t in NatureTroopType.objects.all()}

        if options['clear']:
            OasisTroop.objects.all().delete()
            self.stdout.write("نیروهای آبادی پاک شدند.")

        # Spawn troops in each oasis
        oases = Oasis.objects.all()
        spawned = 0
        batch = []
        for oasis in oases:
            spawn_rules = OASIS_TROOP_SPAWN.get(oasis.oasis_type, OASIS_TROOP_SPAWN[1])
            total_def = 0
            for unit_id, min_count, max_count in spawn_rules:
                count = random.randint(min_count, max_count)
                if count <= 0:
                    continue
                troop_type = troop_map.get(unit_id)
                if not troop_type:
                    continue
                batch.append(OasisTroop(oasis=oasis, troop_type=troop_type, count=count))
                total_def += count * max(troop_type.defense_infantry, troop_type.defense_cavalry)
            if batch:
                OasisTroop.objects.bulk_create(batch, ignore_conflicts=True)
                spawned += len(batch)
                batch = []
            # Update defense_strength from actual troops
            if total_def > 0:
                Oasis.objects.filter(id=oasis.id).update(defense_strength=total_def)

        self.stdout.write(self.style.SUCCESS(f"نیرو در {spawned} آبادی اسپاون شد."))
