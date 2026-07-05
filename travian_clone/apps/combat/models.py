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
    # تا تخریب ساختمان/دیوار را حساب کند.
    is_siege_weapon = models.BooleanField(default=False)

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
    name = models.CharField(max_length=50)
    item_type = models.CharField(max_length=20, choices=[('HELMET', 'کلاه‌خود'), ('WEAPON', 'سلاح'), ('HORSE', 'اسب')])
    attack_bonus = models.IntegerField(default=0)  # مثلا +500 قدرت حمله [cite: 40]
    speed_bonus = models.IntegerField(default=0)

    def __str__(self):
        return self.name


class Animal(models.Model):
    name = models.CharField(max_length=50)
    defense_infantry = models.IntegerField()
    defense_cavalry = models.IntegerField()
    gold_price = models.IntegerField(default=10)  # قیمت خرید با سکه برای دفاع از دهکده [cite: 41]

    def __str__(self):
        return self.name