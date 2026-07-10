from django.db import models
from apps.game_engine.models import Village


class TroopType(models.Model):
    """مدل نگهدارنده اطلاعات ثابت هر نیروی نظامی (مثل گرزدار، شوالیه)"""
    name = models.CharField(max_length=50)
    tribe = models.CharField(max_length=10,
                             choices=[('ROMAN', 'Roman'), ('TEUTON', 'Teuton'), ('GAUL', 'Gaul'), ('NATAR', 'Natar')])

    # قدرت‌های نظامی
    attack_power = models.IntegerField(default=10)
    defense_infantry = models.IntegerField(default=10)
    defense_cavalry = models.IntegerField(default=10)

    # سرعت حرکت (خانه‌های نقشه در ساعت) و ظرفیت غارت
    speed = models.IntegerField(default=5)
    carry_capacity = models.IntegerField(default=50)

    # هزینه‌های ساخت
    wood_cost = models.IntegerField(default=100)
    clay_cost = models.IntegerField(default=100)
    iron_cost = models.IntegerField(default=100)
    crop_cost = models.IntegerField(default=100)
    crop_upkeep = models.IntegerField(default=1)  # مصرف گندم در ساعت
    base_train_time = models.IntegerField(default=120)

    # آیا این نیرو یک سلاح محاصره‌ای (منجنیق یا قوچ) محسوب می‌شود؟
    is_siege_weapon = models.BooleanField(default=False)

    # ✅ جدید: تفکیک دقیق نوع سلاح محاصره‌ای برای پیاده‌سازی کامل مکانیک تراوین اصلی:
    # - قوچ/دژکوب (is_ram=True) همیشه فقط به دیوار آسیب می‌زند
    # - منجنیق (is_catapult=True) روی یک ساختمان انتخابی (یا تصادفی) آسیب می‌زند
    is_ram = models.BooleanField(default=False)
    is_catapult = models.BooleanField(default=False)

    # آیا این نیرو مهاجر (Settler) است؟
    is_settler = models.BooleanField(default=False)

    # آیا این نیرو جاسوس (Scout) است؟
    is_scout = models.BooleanField(default=False)
    is_chief = models.BooleanField(default=False)
    is_cavalry = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.tribe})"


class TroopUpgrade(models.Model):
    """
    سطح ارتقای یک نوع نیرو در یک دهکده‌ی مشخص (از طریق آهنگری)، حداکثر تا لول ۲۰.
    هر لول، قدرت حمله/دفاع آن نیرو را وقتی از این دهکده اعزام یا در آن مستقر باشد
    افزایش می‌دهد (۲٪ به‌ازای هر لول).
    """
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='troop_upgrades')
    troop_type = models.ForeignKey(TroopType, on_delete=models.CASCADE)
    level = models.IntegerField(default=0)
    is_upgrading = models.BooleanField(default=False)
    upgrade_ends_at = models.DateTimeField(null=True, blank=True)

    MAX_LEVEL = 20
    BONUS_PER_LEVEL = 0.02  # هر لول ۲٪ افزایش قدرت حمله/دفاع

    class Meta:
        unique_together = ('village', 'troop_type')

    def __str__(self):
        return f"{self.village.name} - {self.troop_type.name} (لول {self.level})"

    @staticmethod
    def get_multiplier(village_id, troop_type_id, cache=None):
        """
        ضریب قدرت این نیرو در این دهکده. اگر cache (دیکشنری troop_type_id -> level)
        از قبل گرفته شده باشد، از آن استفاده می‌کند تا کوئری اضافه نزند.
        """
        if cache is not None:
            level = cache.get(troop_type_id, 0)
            return 1 + (level * TroopUpgrade.BONUS_PER_LEVEL)
        try:
            upgrade = TroopUpgrade.objects.get(village_id=village_id, troop_type_id=troop_type_id)
            return 1 + (upgrade.level * TroopUpgrade.BONUS_PER_LEVEL)
        except TroopUpgrade.DoesNotExist:
            return 1.0


class VillageTroop(models.Model):
    """تعداد نیروهای مستقر در هر دهکده - تنها منبع صحت برای تعداد نیروها"""
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='troops')
    troop_type = models.ForeignKey(TroopType, on_delete=models.CASCADE)
    count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('village', 'troop_type')

    def __str__(self):
        return f"{self.village.name} - {self.troop_type.name}: {self.count}"


class TroopMovement(models.Model):
    """تحرکات نظامی شامل مبدا، مقصد، نوع نیروها، زمان حرکت و زمان رسیدن"""
    MOVEMENT_TYPES = [
        ('ATTACK', 'حمله عادی'),
        ('RAID', 'غارت'),
        ('REINFORCEMENT', 'پشتیبانی'),
        ('SCOUT', 'شناسایی'),
        ('RETURN', 'بازگشت')
    ]

    source_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='outgoing_movements')
    target_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='incoming_movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)

    troops_payload = models.JSONField(default=dict)
    loot_payload = models.JSONField(default=dict, blank=True)

    # ✅ جدید: نام نوع ساختمانی که منجنیق‌های این حمله باید هدف بگیرند.
    # اگر None یا 'RANDOM' باشد، در لحظه‌ی نتیجه‌گیری یک ساختمان تصادفی (غیر از دیوار
    # و غیر از مزارع منابع) در دهکده‌ی هدف انتخاب می‌شود - دقیقا مانند تراوین اصلی.
    catapult_target_building = models.CharField(max_length=50, null=True, blank=True)

    start_time = models.DateTimeField(auto_now_add=True)
    arrival_time = models.DateTimeField()

    is_completed = models.BooleanField(default=False)
    hero_participating = models.BooleanField(default=False)

    farm_list_entry = models.ForeignKey(
        'FarmListEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='movements'
    )

    def __str__(self):
        return f"{self.movement_type} from {self.source_village.name} to {self.target_village.name}"


class FarmListEntry(models.Model):
    """یک ردیف ثابت در «لیست مزرعه»"""
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='farm_list_entries')
    source_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='farm_list_entries')
    target_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='+')

    troops_payload = models.JSONField(default=dict)

    last_run_at = models.DateTimeField(null=True, blank=True)
    last_run_status = models.CharField(
        max_length=20,
        choices=[('SUCCESS', 'موفق'), ('FAILED', 'ناموفق'), ('NEVER', 'هنوز اجرا نشده')],
        default='NEVER',
    )
    last_loot_summary = models.CharField(max_length=255, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"FarmList: {self.source_village.name} -> {self.target_village.name}"


class HeroItem(models.Model):
    """کاتالوگ آیتم‌های قابل تجهیز برای قهرمان (کلاه‌خود، سلاح، اسب)."""
    name = models.CharField(max_length=50)
    item_type = models.CharField(max_length=20, choices=[('HELMET', 'کلاه‌خود'), ('WEAPON', 'سلاح'), ('HORSE', 'اسب')])
    attack_bonus = models.IntegerField(default=0)
    speed_bonus = models.IntegerField(default=0)

    def __str__(self):
        return self.name


class Animal(models.Model):
    """کاتالوگ حیواناتی که بازیکن می‌تواند با سکه طلا برای دفاع از دهکده بخرد."""
    name = models.CharField(max_length=50)
    defense_infantry = models.IntegerField()
    defense_cavalry = models.IntegerField()
    gold_price = models.IntegerField(default=10)

    def __str__(self):
        return self.name


class Hero(models.Model):
    """
    قهرمان هر بازیکن.

    ✅ فیلدهای جدید نسبت به نسخه‌ی قبل:
    - fighting_strength_points / off_bonus_points / def_bonus_points / resource_points:
      امتیازهای قابل‌توزیع قهرمان (۴ امتیاز به‌ازای هر لول، دقیقا مثل تراوین اصلی).
    - resource_production_type: نوع منبعی که امتیازهای «منابع» قهرمان تولید می‌کنند.
    - participates_in_defense: سوییچ «قهرمان در دفاع دهکده شرکت کند یا نه».
    """
    RESOURCE_CHOICES = [
        ('wood', 'چوب'), ('clay', 'خشت'), ('iron', 'آهن'), ('crop', 'گندم'),
    ]

    player = models.OneToOneField('authentication.Player', on_delete=models.CASCADE, related_name='hero')
    level = models.IntegerField(default=1)
    experience = models.IntegerField(default=0)
    health = models.FloatField(default=100)
    is_alive = models.BooleanField(default=True)

    home_village = models.ForeignKey(Village, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    is_on_adventure = models.BooleanField(default=False)
    is_away = models.BooleanField(default=False)
    adventure_returns_at = models.DateTimeField(null=True, blank=True)
    last_health_update = models.DateTimeField(auto_now_add=True)

    # ✅ سیستم امتیاز خصوصیات (مطابق تراوین اصلی: هر لول = ۴ امتیاز)
    fighting_strength_points = models.IntegerField(default=0)
    off_bonus_points = models.IntegerField(default=0)
    def_bonus_points = models.IntegerField(default=0)
    resource_points = models.IntegerField(default=0)
    resource_production_type = models.CharField(max_length=10, choices=RESOURCE_CHOICES, default='wood')

    # ✅ سوییچ مشارکت در دفاع دهکده
    participates_in_defense = models.BooleanField(default=True)

    # ✅ ظاهر قابل‌شخصی‌سازی قهرمان (شبیه تراوین اصلی).
    # هر عدد فقط «شماره‌ی گزینه» در آن دسته است (بین ۱ تا APPEARANCE_OPTION_COUNT)؛
    # خود تصاویر باید توسط طراح در public/assets/hero/... قرار بگیرند.
    GENDER_CHOICES = [('MALE', 'مرد'), ('FEMALE', 'زن')]
    APPEARANCE_OPTION_COUNT = 6

    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='MALE')
    head_style = models.PositiveSmallIntegerField(default=1)
    hair_color = models.PositiveSmallIntegerField(default=1)
    hair_style = models.PositiveSmallIntegerField(default=1)
    ear_style = models.PositiveSmallIntegerField(default=1)
    eyebrow_style = models.PositiveSmallIntegerField(default=1)
    eye_style = models.PositiveSmallIntegerField(default=1)
    nose_style = models.PositiveSmallIntegerField(default=1)
    mouth_style = models.PositiveSmallIntegerField(default=1)

    POINTS_PER_LEVEL = 4
    RESOURCE_UNITS_PER_POINT_PER_HOUR = 3  # هر امتیاز منابع، این مقدار در ساعت تولید می‌کند
    OFF_DEF_BONUS_PERCENT_PER_POINT = 0.5  # هر امتیاز تهاجمی/دفاعی، این درصد بونوس می‌دهد

    @property
    def total_attribute_points(self):
        return self.level * self.POINTS_PER_LEVEL

    @property
    def used_attribute_points(self):
        return (
            self.fighting_strength_points + self.off_bonus_points +
            self.def_bonus_points + self.resource_points
        )

    @property
    def available_attribute_points(self):
        return max(0, self.total_attribute_points - self.used_attribute_points)

    def __str__(self):
        return f"Hero of {self.player.username} (Lvl {self.level})"


class PlayerHeroItem(models.Model):
    """آیتم‌های موجود در کوله‌پشتی قهرمان یک بازیکن."""
    hero = models.ForeignKey(Hero, on_delete=models.CASCADE, related_name='inventory')
    item = models.ForeignKey(HeroItem, on_delete=models.CASCADE)
    is_equipped = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.hero.player.username} - {self.item.name} ({'پوشیده' if self.is_equipped else 'انبار'})"


class VillageAnimal(models.Model):
    """حیوانات نگهبانی که بازیکن با طلا برای تقویت دفاع یک دهکده مشخص خریده است."""
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='animals')
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE)
    count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('village', 'animal')

    def __str__(self):
        return f"{self.village.name} - {self.animal.name}: {self.count}"


class TrainingQueue(models.Model):
    """صف واقعی آموزش نیرو در پادگان."""
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='training_queue')
    troop_type = models.ForeignKey(TroopType, on_delete=models.CASCADE)
    count = models.IntegerField()
    started_at = models.DateTimeField(auto_now_add=True)
    finishes_at = models.DateTimeField()
    is_completed = models.BooleanField(default=False)

    class Meta:
        ordering = ['finishes_at']

    def __str__(self):
        return f"{self.village.name} - {self.count}x {self.troop_type.name} (تا {self.finishes_at})"


class Adventure(models.Model):
    """نقاط ماجراجویی که به‌صورت دوره‌ای نزدیک دهکده هر بازیکن ظاهر می‌شوند."""
    DIFFICULTY_CHOICES = [
        ('EASY', 'آسان'),
        ('NORMAL', 'متوسط'),
        ('HARD', 'سخت'),
    ]

    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='adventures')
    x_coord = models.IntegerField()
    y_coord = models.IntegerField()
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='NORMAL')
    is_completed = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Adventure ({self.x_coord}|{self.y_coord}) - {self.difficulty} for {self.player.username}"