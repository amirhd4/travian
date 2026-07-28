from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
import datetime

from apps.game_engine.models import Village, VillageBuilding, BuildingType, ServerSetting
from apps.authentication.models import Player
from apps.combat.models import TroopType, TrainingQueue, ResearchedTroop
from rest_framework_simplejwt.tokens import RefreshToken

class CavalryTrainingTests(TestCase):
    def setUp(self):
        # Create server settings
        self.settings = ServerSetting.objects.create(
            is_active=True,
            starting_max_storage=800,
            starting_max_granary=800,
            troop_training_speed=1
        )

        # Create player
        self.player = Player.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="password123",
            tribe="ROMAN"
        )

        # Create village
        self.village = Village.objects.create(
            player=self.player,
            name="Capital Village",
            x_coord=0,
            y_coord=0,
            wood=10000,
            clay=10000,
            iron=10000,
            crop=10000
        )

        # Create Building Types
        self.bt_barracks, _ = BuildingType.objects.get_or_create(name="پادگان")
        self.bt_stable, _ = BuildingType.objects.get_or_create(name="اصطبل")
        self.bt_workshop, _ = BuildingType.objects.get_or_create(name="کارگاه")

        # Create Troop Types
        self.infantry, _ = TroopType.objects.update_or_create(
            id=1,
            defaults={
                "name": "سرباز لژیون",
                "tribe": "ROMAN",
                "wood_cost": 120,
                "clay_cost": 100,
                "iron_cost": 150,
                "crop_cost": 30,
                "base_train_time": 100,
                "is_cavalry": False,
                "is_siege_weapon": False
            }
        )

        self.cavalry_scout, _ = TroopType.objects.update_or_create(
            id=4,
            defaults={
                "name": "خبرچین",
                "tribe": "ROMAN",
                "wood_cost": 140,
                "clay_cost": 160,
                "iron_cost": 20,
                "crop_cost": 40,
                "base_train_time": 120,
                "is_scout": True,
                "is_cavalry": True,
                "is_siege_weapon": False
            }
        )

        self.cavalry, _ = TroopType.objects.update_or_create(
            id=5,
            defaults={
                "name": "شوالیه",
                "tribe": "ROMAN",
                "wood_cost": 550,
                "clay_cost": 440,
                "iron_cost": 320,
                "crop_cost": 100,
                "base_train_time": 200,
                "is_cavalry": True,
                "is_siege_weapon": False
            }
        )

        self.siege, _ = TroopType.objects.update_or_create(
            id=7,
            defaults={
                "name": "دژکوب",
                "tribe": "ROMAN",
                "wood_cost": 900,
                "clay_cost": 360,
                "iron_cost": 500,
                "crop_cost": 70,
                "base_train_time": 300,
                "is_cavalry": False,
                "is_siege_weapon": True
            }
        )

        # Assume they are already researched to skip research verification in tests
        ResearchedTroop.objects.get_or_create(village=self.village, troop_type=self.infantry)
        ResearchedTroop.objects.get_or_create(village=self.village, troop_type=self.cavalry_scout)
        ResearchedTroop.objects.get_or_create(village=self.village, troop_type=self.cavalry)
        ResearchedTroop.objects.get_or_create(village=self.village, troop_type=self.siege)

        # Generate JWT token and set in client headers
        token = RefreshToken.for_user(self.player).access_token
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

    def test_scouts_classified_as_cavalry(self):
        """Verify Roman Scout is correctly classified as cavalry."""
        self.assertTrue(self.cavalry_scout.is_cavalry)

    def test_training_speed_multiplier_formula(self):
        """Verify the formula 0.9 ** (level - 1) is correctly applied based on building levels."""
        # 1. Create a Barracks at Level 1
        vb_barracks = VillageBuilding.objects.create(
            village=self.village,
            building_type=self.bt_barracks,
            position=19,
            level=1
        )

        # Train 1 infantry unit. Duration should be exactly base_train_time (100 seconds)
        response = self.client.post('/api/combat/barracks/train/', {
            'village_id': self.village.id,
            'troop_type': self.infantry.id,
            'quantity': 1
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)

        q_item = TrainingQueue.objects.filter(village=self.village).first()
        self.assertIsNotNone(q_item)
        duration = (q_item.finishes_at - timezone.now()).total_seconds()
        self.assertAlmostEqual(duration, 100, delta=2)

        # 2. Upgrade Barracks to Level 10
        vb_barracks.level = 10
        vb_barracks.save()

        TrainingQueue.objects.all().delete()

        response = self.client.post('/api/combat/barracks/train/', {
            'village_id': self.village.id,
            'troop_type': self.infantry.id,
            'quantity': 1
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)

        q_item = TrainingQueue.objects.filter(village=self.village).first()
        duration = (q_item.finishes_at - timezone.now()).total_seconds()

        # Expected duration = base_train_time * (0.9 ** 9) = 100 * 0.38742 = 38.74 seconds
        expected_duration = 100 * (0.9 ** 9)
        self.assertAlmostEqual(duration, expected_duration, delta=2)

    def test_sequential_building_specific_queues(self):
        """Verify training queues are sequential within the same building but independent across buildings."""
        # Setup Barracks, Stable and Workshop in the village
        vb_barracks = VillageBuilding.objects.create(
            village=self.village,
            building_type=self.bt_barracks,
            position=19,
            level=5 # multiplier: 0.9 ** 4 = 0.6561
        )

        vb_stable = VillageBuilding.objects.create(
            village=self.village,
            building_type=self.bt_stable,
            position=20,
            level=10 # multiplier: 0.9 ** 9 = 0.38742
        )

        # Train first infantry (duration = 100 * 0.6561 = 65.61s)
        response = self.client.post('/api/combat/barracks/train/', {
            'village_id': self.village.id,
            'troop_type': self.infantry.id,
            'quantity': 1
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)

        # Train second infantry (should start after first completes)
        response = self.client.post('/api/combat/barracks/train/', {
            'village_id': self.village.id,
            'troop_type': self.infantry.id,
            'quantity': 1
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)

        # Train cavalry in stable (should start immediately independent of Barracks queue)
        response = self.client.post('/api/combat/barracks/train/', {
            'village_id': self.village.id,
            'troop_type': self.cavalry.id,
            'quantity': 1
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)

        # Retrieve queue items
        infantry_queue = list(TrainingQueue.objects.filter(troop_type=self.infantry).order_by('finishes_at'))
        cavalry_queue = list(TrainingQueue.objects.filter(troop_type=self.cavalry).order_by('finishes_at'))

        self.assertEqual(len(infantry_queue), 2)
        self.assertEqual(len(cavalry_queue), 1)

        # Sequential check: finishes_at of 2nd infantry should be finishes_at of 1st infantry + duration of 2nd infantry
        diff_infantry = (infantry_queue[1].finishes_at - infantry_queue[0].finishes_at).total_seconds()
        self.assertAlmostEqual(diff_infantry, 65.61, delta=2)

        # Independent check: cavalry should finish around timezone.now() + stable_duration (200 * 0.38742 = 77.48s)
        duration_cavalry = (cavalry_queue[0].finishes_at - timezone.now()).total_seconds()
        self.assertAlmostEqual(duration_cavalry, 77.48, delta=2)
