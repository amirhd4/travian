from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class ServerSetting(models.Model):
    server_speed = models.BigIntegerField(default=1)
    troop_speed = models.IntegerField(default=1)
    building_speed = models.IntegerField(default=1)
    duration_days = models.IntegerField(default=365)
    is_active = models.BooleanField(default=True)
    start_date = models.DateTimeField(auto_now_add=True)
    ww_unlocked = models.BooleanField(default=False)

    # وضعیت پایان بازی. قبل از این فیلدها، هیچ راهی برای اعلام برنده یا
    # بستن سرور وقتی شگفتی جهان به سطح ۱۰۰ می‌رسید وجود نداشت - سرور
    # می‌توانست تا ابد بدون هیچ نتیجه‌ی رسمی ادامه پیدا کند.
    is_finished = models.BooleanField(default=False)
    finished_at = models.DateTimeField(null=True, blank=True)
    winner_player = models.ForeignKey(
        'authentication.Player', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    winner_alliance = models.ForeignKey(
        'Alliance', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )


class Village(models.Model):
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='villages')
    name = models.CharField(max_length=50, default='New Village')
    x_coord = models.IntegerField()
    y_coord = models.IntegerField()

    # اولین دهکده هر بازیکن به عنوان پایتخت علامت‌گذاری می‌شود
    # (برای انتخاب پیش‌فرض دهکده فعال در فرانت‌اند و منطق‌های آینده مثل انتقال پایتخت)
    is_capital = models.BooleanField(default=False)

    # منابع (مقادیر ذخیره شده در آخرین آپدیت)
    wood = models.FloatField(default=750.0)
    clay = models.FloatField(default=750.0)
    iron = models.FloatField(default=750.0)
    crop = models.FloatField(default=750.0)

    # نرخ تولید پایه در ساعت (بدون احتساب سرعت سرور)
    prod_wood = models.IntegerField(default=20)
    prod_clay = models.IntegerField(default=20)
    prod_iron = models.IntegerField(default=20)
    prod_crop = models.IntegerField(default=20)

    # ظرفیت انبارها
    max_storage = models.IntegerField(default=800)
    max_granary = models.IntegerField(default=800)

    # زمان آخرین آپدیت برای محاسبه دلتای منابع
    last_update = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('x_coord', 'y_coord')
        indexes = [models.Index(fields=['x_coord', 'y_coord'])]

    def __str__(self):
        return f"{self.name} ({self.x_coord}|{self.y_coord}) - {self.player}"


class BuildingType(models.Model):
    """مدل نگهدارنده اطلاعات ثابت ساختمان‌ها (مثل پادگان، انبار، معدن آهن)"""
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    # هزینه‌های پایه برای سطح ۱
    base_wood_cost = models.IntegerField(default=50)
    base_clay_cost = models.IntegerField(default=50)
    base_iron_cost = models.IntegerField(default=50)
    base_crop_cost = models.IntegerField(default=50)

    # زمان پایه ساخت (به ثانیه) برای سطح ۱
    base_build_time = models.IntegerField(default=120)

    # مصرف گندم این ساختمان در ساعت
    crop_upkeep = models.IntegerField(default=2)

    # مشخص می‌کند این نوع ساختمان نقش «دیوار دفاعی» را ایفا می‌کند.
    # به این ترتیب موتور نبرد به‌جای جستجوی ساختمان بر اساس نام (که شکننده است)
    # می‌تواند دیوار دهکده را با یک کوئری ساده پیدا کند.
    provides_wall_defense = models.BooleanField(default=False)

    # دسته‌بندی ساختمان برای رندر بصری متفاوت در فرانت‌اند (به‌جای تطبیق روی
    # رشته نام که شکننده است). RESOURCE = مزارع منابع، MILITARY = پادگان/اصطبل،
    # INFRASTRUCTURE = ساختمان اصلی/انبار/سیلو/محل گردهمایی، WALL = دیوار.
    CATEGORY_CHOICES = [
        ('RESOURCE', 'منبع'),
        ('INFRASTRUCTURE', 'زیرساخت'),
        ('MILITARY', 'نظامی'),
        ('WALL', 'دیوار'),
    ]
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='INFRASTRUCTURE')

    # سقف سطح این نوع ساختمان. قبل از این فیلد، ساختمان‌ها بدون هیچ محدودیتی
    # تا بی‌نهایت قابل ارتقا بودند.
    max_level = models.IntegerField(default=20)

    def __str__(self):
        return self.name


class VillageBuilding(models.Model):
    """مدل نگهدارنده ساختمان‌های ساخته شده در هر دهکده"""
    village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='buildings')
    building_type = models.ForeignKey(BuildingType, on_delete=models.CASCADE)

    # هر دهکده در تراوین حدود ۴۰ اسلات (جایگاه) برای ساخت دارد
    position = models.IntegerField()
    level = models.IntegerField(default=0)

    # وضعیت ارتقا
    is_upgrading = models.BooleanField(default=False)
    upgrade_end_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('village', 'position')

    def __str__(self):
        return f"{self.village.name} - {self.building_type.name} (Lvl {self.level})"


class GoldPackage(models.Model):
    name = models.CharField(max_length=100)
    gold_amount = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2) # قیمت به تومان یا ریال
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.gold_amount} Gold"

class Discount(models.Model):
    percentage = models.IntegerField() # مثلا 25 برای ۲۵ درصد تخفیف
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
    """
    محموله‌ی تجاری بین دو دهکده که با تعداد مشخصی تاجر (Merchant) و در طول
    زمان واقعی سفر جابه‌جا می‌شود.

    قبل از این مدل، MarketplaceView منابع را به‌صورت آنی و بدون هیچ زمان
    سفر یا محدودیت ظرفیت تاجر منتقل می‌کرد؛ یعنی عملا هیچ «بازارچه»ی
    واقعی وجود نداشت.
    """
    source_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='outgoing_trades')
    target_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='incoming_trades')

    wood = models.PositiveIntegerField(default=0)
    clay = models.PositiveIntegerField(default=0)
    iron = models.PositiveIntegerField(default=0)
    crop = models.PositiveIntegerField(default=0)

    merchants_used = models.PositiveIntegerField(default=1)

    dispatched_at = models.DateTimeField(auto_now_add=True)
    delivery_time = models.DateTimeField()          # زمان رسیدن منابع به مقصد
    merchants_return_time = models.DateTimeField()  # زمان بازگشت تاجرها به مبدا (آزاد شدن ظرفیت)

    is_delivered = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)  # یعنی تاجرها هم برگشتند

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
    role = models.CharField(max_length=50, default='Member') # e.g., Leader, Diplomat, Member

    def __str__(self):
        return f"{self.player} in {self.alliance.tag}"


class QuestDefinition(models.Model):
    """
    تعریف یک کوئست تیوتوریال (مثل «ارتقای ساختمان اصلی به سطح ۳»). این
    مدل قالب کوئست است، نه پیشرفت شخصی هر بازیکن.

    قبل از این مدل، هیچ سیستم کوئست/تیوتوریالی وجود نداشت؛ بازیکن تازه‌وارد
    بعد از ثبت‌نام فقط یک دهکده خالی می‌دید و هیچ راهنمایی گام‌به‌گامی
    دریافت نمی‌کرد.
    """
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
    """پیشرفت شخصی هر بازیکن در هر کوئست."""
    player = models.ForeignKey('authentication.Player', on_delete=models.CASCADE, related_name='quest_progress')
    quest = models.ForeignKey(QuestDefinition, on_delete=models.CASCADE, related_name='+')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_reward_claimed = models.BooleanField(default=False)

    class Meta:
        unique_together = ('player', 'quest')

    def __str__(self):
        return f"{self.player.username} - {self.quest.title}"