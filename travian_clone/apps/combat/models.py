from django.db import models
from apps.game_engine.models import Village


class TroopType(models.Model):
    """مدل نگهدارنده اطلاعات ثابت هر نیروی نظامی (مثل گرزدار، شوالیه)"""
    name = models.CharField(max_length=50)
    tribe = models.CharField(max_length=10,
                             choices=[('ROMAN', 'Roman'), ('TEUTON', 'Teuton'), ('GAUL', 'Gaul'), ('NATAR', 'Natar')])

    # قدرت‌های نظامی[cite: 1]
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

    # آیا این نیرو یک سلاح محاصره‌ای (منجنیق/قوچ) محسوب می‌شود؟
    # موتور نبرد از این فلگ برای محاسبه تعداد منجنیق‌های اعزامی استفاده می‌کند
    # تا تخریب دیوار را حساب کند.
    is_siege_weapon = models.BooleanField(default=False)

    # آیا این نیرو مهاجر (Settler) است؟ برای تاسیس دهکده جدید به ۳ عدد از این نیرو
    # در دهکده مبدا نیاز است (services.found_new_village آن را مصرف می‌کند).
    is_settler = models.BooleanField(default=False)

    # آیا این نیرو جاسوس (Scout) است؟ برای ماموریت‌های شناسایی (movement_type='SCOUT')
    # استفاده می‌شود و همچنین به عنوان محافظ در برابر جاسوسی دشمن عمل می‌کند.
    is_scout = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.tribe})"


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
    """تحرکات نظامی شامل مبدا، مقصد، نوع نیروها، زمان حرکت و زمان رسیدن[cite: 1]"""
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

    # ذخیره نیروهای ارسال شده به صورت JSON (مثلا {"1": 500, "2": 100} که کلیدها آیدی TroopType هستند)
    troops_payload = models.JSONField(default=dict)

    # منابع غارت‌شده‌ای که همراه نیروهای بازگشتی (RETURN) به دهکده مبدا می‌رسند
    loot_payload = models.JSONField(default=dict, blank=True)

    start_time = models.DateTimeField(auto_now_add=True)
    arrival_time = models.DateTimeField()

    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.movement_type} from {self.source_village.name} to {self.target_village.name}"


class HeroItem(models.Model):
    """کاتالوگ آیتم‌های قابل تجهیز برای قهرمان (کلاه‌خود، سلاح، اسب)."""
    name = models.CharField(max_length=50)
    item_type = models.CharField(max_length=20, choices=[('HELMET', 'کلاه‌خود'), ('WEAPON', 'سلاح'), ('HORSE', 'اسب')])
    attack_bonus = models.IntegerField(default=0)  # مثلا +500 قدرت حمله [cite: 40]
    speed_bonus = models.IntegerField(default=0)

    def __str__(self):
        return self.name


class Animal(models.Model):
    """کاتالوگ حیواناتی که بازیکن می‌تواند با سکه طلا برای دفاع از دهکده بخرد."""
    name = models.CharField(max_length=50)
    defense_infantry = models.IntegerField()
    defense_cavalry = models.IntegerField()
    gold_price = models.IntegerField(default=10)  # قیمت خرید با سکه برای دفاع از دهکده [cite: 41]

    def __str__(self):
        return self.name


class Hero(models.Model):
    """
    قهرمان هر بازیکن. قبل از این مدل، HeroItem صرفا یک جدول کاتالوگ بدون استفاده بود
    و هیچ منطقی برای مالکیت/تجهیز/تاثیرگذاری روی نبرد وجود نداشت.

    ساده‌سازی عمدی: این جایگزین کامل سیستم ماجراجویی/فروشگاه قهرمان تراوین اصلی
    نیست، بلکه یک نسخه ساده و در عین حال واقعا اثرگذار روی نبردهاست.
    """
    player = models.OneToOneField('authentication.Player', on_delete=models.CASCADE, related_name='hero')
    level = models.IntegerField(default=1)
    experience = models.IntegerField(default=0)
    health = models.IntegerField(default=100)
    is_alive = models.BooleanField(default=True)

    # دهکده‌ای که قهرمان در آن مستقر است و از آن دفاع می‌کند
    home_village = models.ForeignKey(Village, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    def __str__(self):
        return f"Hero of {self.player.username} (Lvl {self.level})"


class PlayerHeroItem(models.Model):
    """آیتم‌های موجود در کوله‌پشتی قهرمان یک بازیکن (کپی شخصی از HeroItem کاتالوگ)."""
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
    """
    صف واقعی آموزش نیرو در پادگان.

    قبل از این مدل، آموزش نیرو یا کاملا آنی بود (بدون هیچ زمان انتظاری) یا
    فقط از طریق یک تسک Celery «شلیک و فراموش» بدون هیچ رکورد قابل مشاهده‌ای
    زمان‌بندی می‌شد؛ یعنی هیچ راهی برای فرانت‌اند وجود نداشت که به کاربر نشان
    دهد الان دقیقا چه چیزی و با چه زمان باقی‌مانده‌ای در حال آموزش است.
    """
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