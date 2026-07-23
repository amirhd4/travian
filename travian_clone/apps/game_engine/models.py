from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class ServerSetting(models.Model):
    # سرعت کلی تولید منابع
    server_speed = models.BigIntegerField(default=1)
    # سرعت حرکت نیرو روی نقشه (جابه‌جایی/حمله/غارت/بازگشت)
    troop_speed = models.BigIntegerField(default=1)
    # ✅ سرعت ساخت‌وساز ساختمان‌ها (قبلا تعریف شده بود ولی هیچ‌جا استفاده نمی‌شد)
    building_speed = models.BigIntegerField(default=1)
    # ✅ جدید: سرعت آموزش نیرو در پادگان/اصطبل/کارگاه (کاملا جدا از سرعت حرکت و ساخت‌وساز)
    troop_training_speed = models.BigIntegerField(default=1)

    duration_days = models.IntegerField(default=365)
    is_active = models.BooleanField(default=True)
    start_date = models.DateTimeField(auto_now_add=True)
    ww_unlocked = models.BooleanField(default=False)

    artifacts_unlocked = models.BooleanField(default=False)
    artifact_release_duration_percent = models.FloatField(default=50)

    # ✅ ظرفیت پیش‌فرض انبار/سیلو برای دهکده‌های جدید این سرور
    starting_max_storage = models.IntegerField(default=800)
    starting_max_granary = models.IntegerField(default=800)

    # ✅ تنظیمات دهکده‌های فارم (تعداد و ضریب تولید، هر دو قابل تنظیم توسط ادمین موقع نصب سرور)
    farm_village_count = models.IntegerField(default=20)
    farm_village_multiplier = models.IntegerField(default=1)
    farm_production_per_hour = models.IntegerField(default=1000000, help_text="تولید هر منبع در ساعت برای هر دهکده فارم")

    # ✅ مدت زمان محافظت تازه‌واردان در برابر حمله/غارت/تسخیر (به روز)، قابل تنظیم برای هر سرور
    new_player_protection_days = models.IntegerField(default=7)

    # وضعیت پایان بازی
    is_finished = models.BooleanField(default=False)
    finished_at = models.DateTimeField(null=True, blank=True)
    winner_player = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    winner_alliance = models.ForeignKey(
        'Alliance', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    # عناوین پایان بازی
    greatest_empire_player = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
        verbose_name="بزرگترین امپراتوری (بیشترین جمعیت)"
    )
    top_attacker_player = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
        verbose_name="برترین مهاجم"
    )
    top_defender_player = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
        verbose_name="برترین مدافع"
    )

    culture_point_speed = models.BigIntegerField(default=1)

    # apps/game_engine/models.py -> class ServerSetting
    catapult_unlocked = models.BooleanField(default=False)
    catapult_release_duration_percent = models.FloatField(default=30)


class Village(models.Model):
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='villages')
    name = models.CharField(max_length=50, default='New Village')
    x_coord = models.IntegerField()
    y_coord = models.IntegerField()

    is_capital = models.BooleanField(default=False)

    wood = models.FloatField(default=750.0)
    clay = models.FloatField(default=750.0)
    iron = models.FloatField(default=750.0)
    crop = models.FloatField(default=750.0)

    prod_wood = models.IntegerField(default=20)
    prod_clay = models.IntegerField(default=20)
    prod_iron = models.IntegerField(default=20)
    prod_crop = models.IntegerField(default=20)

    max_storage = models.IntegerField(default=800)
    max_granary = models.IntegerField(default=800)

    last_update = models.DateTimeField(auto_now_add=True)

    loyalty = models.FloatField(default=100)
    is_natar_ww_site = models.BooleanField(default=False)
    is_natar_plan_guard = models.BooleanField(default=False)
    is_farm_village = models.BooleanField(default=False)

    last_npc_trade_at = models.DateTimeField(null=True, blank=True)

    is_natar_artifact_site = models.BooleanField(default=False)

    field_type = models.IntegerField(default=0, help_text="Resource field type 0-12 (0=empty/oasis)")

    class Meta:
        unique_together = ('x_coord', 'y_coord')
        indexes = [models.Index(fields=['x_coord', 'y_coord'])]

        def __str__(self):
            return f"{self.amount} گلد -> {self.email} (پین: {self.pin_code})"


class TownHallCelebration(models.Model):
    """
    ✅ جدید: جشن تالار شهر (کوچک/بزرگ) - قبلا «تالار شهر» صرفا یک اسلات
    بدون هیچ کارکردی بود. طبق تراوین اصلی، تالار شهر امکان برگزاری جشن را
    می‌دهد که مقدار قابل‌توجهی امتیاز فرهنگی فوری در ازای منابع می‌دهد؛
    هر دهکده در هر لحظه فقط می‌تواند یک جشن فعال داشته باشد.
    """
    CELEBRATION_TYPES = [
        ('SMALL', 'جشن کوچک'),
        ('GREAT', 'جشن بزرگ'),
    ]

    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='celebrations')
    celebration_type = models.CharField(max_length=10, choices=CELEBRATION_TYPES)
    culture_points_reward = models.FloatField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField()
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.get_celebration_type_display()} - {self.village.name}"


class BuildingType(models.Model):
    """مدل نگهدارنده اطلاعات ثابت ساختمان‌ها"""
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    base_wood_cost = models.IntegerField(default=50)
    base_clay_cost = models.IntegerField(default=50)
    base_iron_cost = models.IntegerField(default=50)
    base_crop_cost = models.IntegerField(default=50)

    base_build_time = models.IntegerField(default=120)

    crop_upkeep = models.IntegerField(default=2)

    provides_wall_defense = models.BooleanField(default=False)

    CATEGORY_CHOICES = [
        ('RESOURCE', 'منبع'),
        ('INFRASTRUCTURE', 'زیرساخت'),
        ('MILITARY', 'نظامی'),
        ('WALL', 'دیوار'),
    ]
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='INFRASTRUCTURE')

    max_level = models.IntegerField(default=20)

    def __str__(self):
        return self.name


class VillageBuilding(models.Model):
    """مدل نگهدارنده ساختمان‌های ساخته شده در هر دهکده"""
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='buildings')
    building_type = models.ForeignKey(BuildingType, on_delete=models.CASCADE)

    position = models.IntegerField()
    level = models.IntegerField(default=0)

    is_upgrading = models.BooleanField(default=False)
    upgrade_end_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('village', 'position')

    def __str__(self):
        return f"{self.village.name} - {self.building_type.name} (Lvl {self.level})"


class GoldPackage(models.Model):
    name = models.CharField(max_length=100)
    gold_amount = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.gold_amount} Gold"


class Discount(models.Model):
    percentage = models.IntegerField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.percentage}% Discount"


class Transaction(models.Model):
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE)
    package = models.ForeignKey(GoldPackage, on_delete=models.SET_NULL, null=True)
    authority = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)


class GameLog(models.Model):
    LOG_TYPES = [
        ('BUILDING', 'ساخت و ساز'),
        ('COMBAT', 'نبرد'),
        ('TRADE', 'تجارت'),
        ('SYSTEM', 'سیستم')
    ]
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='logs')
    log_type = models.CharField(max_length=20, choices=LOG_TYPES)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_log_type_display()} - {self.village.name} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class ResourceTrade(models.Model):
    source_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='outgoing_trades')
    target_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='incoming_trades')

    wood = models.PositiveIntegerField(default=0)
    clay = models.PositiveIntegerField(default=0)
    iron = models.PositiveIntegerField(default=0)
    crop = models.PositiveIntegerField(default=0)

    merchants_used = models.PositiveIntegerField(default=1)

    dispatched_at = models.DateTimeField(auto_now_add=True)
    delivery_time = models.DateTimeField()
    merchants_return_time = models.DateTimeField()

    is_delivered = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)

    def total_resources(self):
        return self.wood + self.clay + self.iron + self.crop

    def __str__(self):
        return f"Trade {self.source_village.name} -> {self.target_village.name} ({self.total_resources()})"


class Message(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_messages', on_delete=models.CASCADE)
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='received_messages', on_delete=models.CASCADE)
    subject = models.CharField(max_length=255, default='(بدون عنوان)')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.subject} - از {self.sender} به {self.receiver}"


class Alliance(models.Model):
    name = models.CharField(max_length=100, unique=True)
    tag = models.CharField(max_length=10, unique=True)
    founder = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='founded_alliances', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"[{self.tag}] {self.name}"


class AllianceMember(models.Model):
    alliance = models.ForeignKey(Alliance, related_name='members', on_delete=models.CASCADE)
    player = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='alliance_membership', on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=50, default='Member')

    def __str__(self):
        return f"{self.player} in {self.alliance.tag}"


class QuestDefinition(models.Model):
    CONDITION_CHOICES = [
        ('MAIN_BUILDING_LEVEL', 'سطح ساختمان اصلی'),
        ('WAREHOUSE_LEVEL', 'سطح انبار'),
        ('GRANARY_LEVEL', 'سطح سیلوی غله'),
        ('RESOURCE_FIELD_LEVEL', 'سطح یکی از مزارع منابع'),
        ('RALLY_POINT_LEVEL', 'سطح محل گردهمایی'),
        ('BARRACKS_LEVEL', 'سطح پادگان'),
        ('MARKETPLACE_LEVEL', 'سطح بازارچه'),
        ('WALL_LEVEL', 'سطح دیوار'),
        ('TROOP_COUNT', 'تعداد کل نیروی آموزش‌دیده'),
        ('TRADE_SENT', 'ارسال حداقل یک محموله تجاری'),
        ('MOVEMENT_SENT', 'اعزام حداقل یک نیرو نظامی'),
        ('SECOND_VILLAGE', 'تاسیس دومین دهکده'),
        ('HERO_ADVENTURE', 'تکمیل حداقل یک ماجراجویی قهرمان'),
    ]

    order = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    condition_type = models.CharField(max_length=30, choices=CONDITION_CHOICES)
    condition_target = models.PositiveIntegerField(default=1)

    reward_wood = models.PositiveIntegerField(default=0)
    reward_clay = models.PositiveIntegerField(default=0)
    reward_iron = models.PositiveIntegerField(default=0)
    reward_crop = models.PositiveIntegerField(default=0)
    reward_gold = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"#{self.order} - {self.title}"


class PlayerQuestProgress(models.Model):
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='quest_progress')
    quest = models.ForeignKey(QuestDefinition, on_delete=models.CASCADE, related_name='+')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_reward_claimed = models.BooleanField(default=False)

    class Meta:
        unique_together = ('player', 'quest')

    def __str__(self):
        return f"{self.player.username} - {self.quest.title}"


class Oasis(models.Model):
    x_coord = models.IntegerField()
    y_coord = models.IntegerField()

    RESOURCE_CHOICES = [
        ('wood', 'چوب'), ('clay', 'خشت'), ('iron', 'آهن'), ('crop', 'گندم'), ('all', 'همه‌ی منابع'),
    ]
    bonus_resource = models.CharField(max_length=10, choices=RESOURCE_CHOICES, default='crop')
    bonus_percent = models.IntegerField(default=25)
    defense_strength = models.IntegerField(default=150)
    oasis_type = models.IntegerField(default=1, help_text="Oasis type 1-12 for tile image selection")

    owner_village = models.ForeignKey(Village, on_delete=models.SET_NULL, null=True, blank=True, related_name='oases')

    class Meta:
        unique_together = ('x_coord', 'y_coord')

    def __str__(self):
        return f"آبادی ({self.x_coord}|{self.y_coord})"

    @property
    def bonuses(self):
        return OASIS_TYPE_BONUSES.get(self.oasis_type, [])

    @property
    def bonus_display(self):
        parts = [f"{r} {p}%" for r, p in self.bonuses]
        return " + ".join(parts) if parts else "None"


# Maps oasis_type (1-12) → list of (resource, percent) tuples
OASIS_TYPE_BONUSES = {
    1:  [('wood', 25)],
    2:  [('wood', 50)],
    3:  [('wood', 25), ('crop', 25)],
    4:  [('clay', 25)],
    5:  [('clay', 50)],
    6:  [('clay', 25), ('crop', 25)],
    7:  [('iron', 25)],
    8:  [('iron', 50)],
    9:  [('iron', 25), ('crop', 25)],
    10: [('crop', 25)],
    11: [('crop', 25)],
    12: [('crop', 50)],
}

OASIS_DEFENSE_RANGES = {
    1: (50, 100), 2: (80, 150), 3: (100, 200),
    4: (50, 100), 5: (80, 150), 6: (100, 200),
    7: (50, 100), 8: (80, 150), 9: (100, 200),
    10: (50, 100), 11: (50, 100), 12: (80, 150),
}


class NatureTroopType(models.Model):
    name = models.CharField(max_length=50)
    name_fa = models.CharField(max_length=50)
    attack = models.IntegerField(default=10)
    defense_infantry = models.IntegerField(default=25)
    defense_cavalry = models.IntegerField(default=20)
    speed = models.IntegerField(default=7)
    unit_id = models.IntegerField(unique=True)

    class Meta:
        ordering = ['unit_id']

    def __str__(self):
        return f"{self.name} (u{self.unit_id})"


class OasisTroop(models.Model):
    oasis = models.ForeignKey(Oasis, on_delete=models.CASCADE, related_name='troops')
    troop_type = models.ForeignKey(NatureTroopType, on_delete=models.CASCADE)
    count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('oasis', 'troop_type')

    def __str__(self):
        return f"{self.count}x {self.troop_type.name} @ ({self.oasis.x_coord}|{self.oasis.y_coord})"


class Artifact(models.Model):
    """
    کتیبه: یک شیء «حساب‌محور» (نه دهکده‌محور). وقتی دهکده‌ی نگه‌دارنده‌اش
    (holder_village) متعلق به یک بازیکن باشد، اثر ویژه‌اش روی کل حساب آن
    بازیکن (یا در صورت is_alliance_wide=True، کل اتحادش) اعمال می‌شود.

    هر بار تصاحب - چه اولین‌بار با تسخیر دهکده‌ی ناتار نگهبان، چه بعدا با
    دزدیدنش از یک بازیکن دیگر - یک تاخیر ۲۴ ساعته‌ی جدید قبل از فعال شدن
    اثر ایجاد می‌کند (دقیقا مثل تراوین اصلی).
    """
    EFFECT_SCOUT_POWER = 'SCOUT_POWER'
    EFFECT_TRAINING_SPEED = 'TRAINING_SPEED'
    EFFECT_MOVEMENT_SPEED = 'MOVEMENT_SPEED'
    EFFECT_CHOICES = [
        (EFFECT_SCOUT_POWER, 'قدرت جاسوسی (چشمان عقاب)'),
        (EFFECT_TRAINING_SPEED, 'سرعت آموزش نیرو (جنگ‌آموز)'),
        (EFFECT_MOVEMENT_SPEED, 'سرعت حرکت نیرو (چکمه خدایان)'),
    ]

    name = models.CharField(max_length=100)
    effect_type = models.CharField(max_length=20, choices=EFFECT_CHOICES)
    multiplier = models.FloatField(default=2.0)

    # کتیبه‌ی «بزرگ»: اثرش روی کل اتحادِ دارنده اعمال می‌شود، نه فقط خودش
    is_alliance_wide = models.BooleanField(default=False)

    holder_village = models.ForeignKey(
        Village, on_delete=models.SET_NULL, null=True, blank=True, related_name='artifacts'
    )
    is_activated = models.BooleanField(default=False)
    captured_at = models.DateTimeField(null=True, blank=True)
    activates_at = models.DateTimeField(null=True, blank=True)

    def is_effective(self):
        return bool(self.holder_village_id and self.activates_at and timezone.now() >= self.activates_at)

    def __str__(self):
        return f"{self.name} ({'فعال' if self.is_activated else 'در انتظار فعال‌سازی'})"


class PlayerCombatStats(models.Model):
    """
    امتیاز تجمعی «مهاجم کلی» و «مدافع کلی» هر بازیکن در طول عمر سرور.
    - attacker_kill_points: ارزش جمعیتیِ نیروهای حریفی که این بازیکن در
      نقش مهاجم کشته است.
    - defender_kill_points: ارزش جمعیتیِ نیروهای حریفی که این بازیکن در
      نقش مدافع کشته است (یعنی تلفات مهاجمین به این بازیکن).
    این مقادیر در لحظه‌ی نتیجه‌گیری هر نبرد به‌روزرسانی می‌شوند
    (apps.combat.tasks._resolve_attack_or_raid).
    """
    player = models.OneToOneField('authentication.Player', on_delete=models.CASCADE, related_name='combat_stats')
    attacker_kill_points = models.FloatField(default=0)
    defender_kill_points = models.FloatField(default=0)

    def __str__(self):
        return f"{self.player.username}: مهاجم={self.attacker_kill_points:.0f} مدافع={self.defender_kill_points:.0f}"


class PlayerDailySnapshot(models.Model):
    """آخرین مقادیر ثبت‌شده‌ی هر بازیکن در پایان محاسبه‌ی مدال‌های روز قبل -
    برای محاسبه‌ی «میزان افزایش امروز» (delta) نسبت به مقدار تجمعی."""
    player = models.OneToOneField('authentication.Player', on_delete=models.CASCADE, related_name='daily_snapshot')
    last_attacker_points = models.FloatField(default=0)
    last_defender_points = models.FloatField(default=0)
    last_population = models.IntegerField(default=0)
    last_day_number = models.PositiveIntegerField(default=0)


class DailyMedal(models.Model):
    """مدال روزانه‌ای که به ۱۰ نفر برتر هر دسته در هر روز از سرور اهدا می‌شود."""
    CATEGORY_CHOICES = [
        ('ATTACKER', 'مهاجم روز'),
        ('DEFENDER', 'مدافع روز'),
        ('POPULATION', 'پیشرفت روز (جمعیت)'),
    ]
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='daily_medals')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    day_number = models.PositiveIntegerField()
    rank = models.PositiveIntegerField()
    awarded_at = models.DateTimeField(auto_now_add=True)
    is_visible = models.BooleanField(default=True)  # بازیکن می‌تواند در پروفایل خودش مخفی/آشکار کند

    class Meta:
        unique_together = ('category', 'day_number', 'rank')
        ordering = ['-day_number', 'category', 'rank']

    def __str__(self):
        return f"روز {self.day_number} - {self.get_category_display()} - رتبه {self.rank} - {self.player.username}"


class GoldBankDeposit(models.Model):
    email = models.EmailField()
    amount = models.PositiveIntegerField()
    pin_code = models.CharField(max_length=20, unique=True)
    depositor = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='gold_bank_deposits'
    )
    is_redeemed = models.BooleanField(default=False)
    redeemed_by = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    redeemed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.amount} گلد -> {self.email} (پین: {self.pin_code})"