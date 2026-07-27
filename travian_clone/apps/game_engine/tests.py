from django.test import TestCase
from apps.game_engine.models import Village, ServerSetting
from apps.authentication.models import Player
from apps.combat.models import TroopType, VillageTroop
from apps.game_engine.views import ResidenceView
from apps.game_engine.utils import _apply_starvation

class GameEngineTests(TestCase):
    def setUp(self):
        # Create server setting
        self.settings = ServerSetting.objects.create(is_active=True, starting_max_storage=800, starting_max_granary=800)

        # Create player
        self.player = Player.objects.create_user(username="testplayer", email="test@example.com", password="password")

        # Create village
        self.village = Village.objects.create(
            player=self.player,
            name="Test Village",
            x_coord=1,
            y_coord=1,
            crop=0.0
        )

        # Create troop type with upkeep
        self.troop_type = TroopType.objects.create(
            name="Test Clubswing",
            tribe="ROMAN",
            crop_upkeep=1
        )

        # Add troops to village
        self.village_troop = VillageTroop.objects.create(
            village=self.village,
            troop_type=self.troop_type,
            count=100
        )

    def test_get_expansion_slots_count(self):
        # Test Residence slots
        self.assertEqual(ResidenceView._get_expansion_slots_count("اقامتگاه", 0), 0)
        self.assertEqual(ResidenceView._get_expansion_slots_count("اقامتگاه", 9), 0)
        self.assertEqual(ResidenceView._get_expansion_slots_count("اقامتگاه", 10), 1)
        self.assertEqual(ResidenceView._get_expansion_slots_count("اقامتگاه", 19), 1)
        self.assertEqual(ResidenceView._get_expansion_slots_count("اقامتگاه", 20), 2)

        # Test Palace slots
        self.assertEqual(ResidenceView._get_expansion_slots_count("قصر", 9), 0)
        self.assertEqual(ResidenceView._get_expansion_slots_count("قصر", 10), 1)
        self.assertEqual(ResidenceView._get_expansion_slots_count("قصر", 14), 1)
        self.assertEqual(ResidenceView._get_expansion_slots_count("قصر", 15), 2)
        self.assertEqual(ResidenceView._get_expansion_slots_count("قصر", 19), 2)
        self.assertEqual(ResidenceView._get_expansion_slots_count("قصر", 20), 3)

    def test_apply_starvation_deficit(self):
        # Initial troop count is 100
        self.assertEqual(self.village_troop.count, 100)

        # Apply starvation with deficit of 5
        _apply_starvation(self.village, 5)

        # Refresh from db
        self.village_troop.refresh_from_db()
        self.assertEqual(self.village_troop.count, 95)
