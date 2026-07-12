from travian_core.celery import app
from apps.game_engine.models import Village, VillageBuilding, GameLog, ResourceTrade
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import random
from django.core.cache import cache
from django.core.mail import send_mail

@app.task
def send_sms_task(phone_number, message):
    # اینجا کد اتصال به وب‌سرویس پیامکی (مثل کاوه‌نگار یا قاصدک) قرار می‌گیرد
    print(f"SMS sent to {phone_number}: {message}")


@app.task
def send_email_task(email_address, subject, body):
    send_mail(
        subject,
        body,
        'noreply@yourgame.com',
        [email_address],
        fail_silently=False,
    )


def generate_and_send_otp(user_identity, method="SMS"):
    otp_code = str(random.randint(100000, 999999))
    cache.set(f"otp_{user_identity}", otp_code, timeout=300)

    if method == "SMS":
        send_sms_task.delay(user_identity, f"کد تایید شما: {otp_code}")
    elif method == "EMAIL":
        send_email_task.delay(user_identity, "Verify Your Account", f"Your OTP is: {otp_code}")


@app.task
def process_game_event(village_id, event_type, details):
    try:
        village = Village.objects.get(id=village_id)
    except Village.DoesNotExist:
        return

    if event_type == "BUILDING_UPGRADE":
        building_id = details.get('building_id')
        next_level = details.get('next_level')

        try:
            building = VillageBuilding.objects.get(id=building_id)
            building.level = next_level
            building.is_upgrading = False
            building.upgrade_end_time = None
            building.save()

            # ثبت لاگ اتمام ساخت‌وساز زمان‌دار
            GameLog.objects.create(
                village=village,
                log_type='BUILDING',
                description=f"ارتقای {building.building_type.name} به سطح {next_level} به پایان رسید."
            )

            # ارسال سیگنال زنده به فرانت‌اند
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"player_{village.player.id}",
                {
                    "type": "send_game_update",
                    "update_type": "building_completed",
                    "payload": {
                        "village_id": village_id,
                        "building_id": building_id,
                        "new_level": next_level,
                    },
                }
            )
        except VillageBuilding.DoesNotExist:
            pass

    elif event_type == "TROOP_RECRUITMENT":
        # نکته حیاتی: قبلا این شاخه اصلا وجود نداشت. یعنی وقتی سرعت سرور
        # طبیعی بود (نه حالت نجومی)، BarracksTrainView این ایونت را به صف
        # Celery می‌فرستاد اما هیچ‌کس آن را پردازش نمی‌کرد - منابع کسر
        # می‌شدند ولی نیروی آموزش‌دیده هرگز به دهکده اضافه نمی‌شد.
        from apps.combat.models import TroopType, VillageTroop, TrainingQueue

        troop_id = details.get('troop_id')
        count = details.get('count')
        queue_id = details.get('queue_id')

        try:
            troop_type = TroopType.objects.get(id=troop_id)
            village_troop, _ = VillageTroop.objects.get_or_create(village=village, troop_type=troop_type)
            village_troop.count += count
            village_troop.save()

            if queue_id:
                TrainingQueue.objects.filter(id=queue_id).update(is_completed=True)

            GameLog.objects.create(
                village=village,
                log_type='SYSTEM',
                description=f"تعداد {count} نیروی {troop_type.name} آموزش خود را به پایان رساند و به پادگان پیوست."
            )

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"player_{village.player.id}",
                {
                    "type": "send_game_update",
                    "update_type": "TROOP_TRAINING_COMPLETED",
                    "payload": {
                        "village_id": village_id,
                        "troop_type_id": troop_id,
                        "count": count,
                        "message": f"آموزش {count} {troop_type.name} در دهکده {village.name} تمام شد.",
                    },
                }
            )
        except TroopType.DoesNotExist:
            pass


@app.task
def deliver_trade_resources(trade_id):
    """
    رسیدن محموله‌ی تجاری به دهکده مقصد. منابع در سقف انبار/سیلوی مقصد
    قرار می‌گیرند و بازگشت تاجرها (آزاد شدن ظرفیت مبدا) جداگانه زمان‌بندی
    می‌شود - دقیقا مثل نحوه‌ی بازگشت نیرو بعد از حمله در apps.combat.tasks.
    """
    try:
        trade = ResourceTrade.objects.select_related('target_village', 'source_village').get(
            id=trade_id, is_delivered=False
        )
    except ResourceTrade.DoesNotExist:
        return "این محموله قبلا تحویل داده شده یا یافت نشد."

    target = trade.target_village
    target.wood = min(target.max_storage, target.wood + trade.wood)
    target.clay = min(target.max_storage, target.clay + trade.clay)
    target.iron = min(target.max_storage, target.iron + trade.iron)
    target.crop = min(target.max_granary, target.crop + trade.crop)
    target.save()

    trade.is_delivered = True
    trade.save()

    total = trade.total_resources()
    description = f"محموله‌ای شامل {total} واحد منبع از دهکده {trade.source_village.name} به این دهکده رسید."
    GameLog.objects.create(village=target, log_type='TRADE', description=description)

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"player_{target.player_id}",
            {
                "type": "send_game_update",
                "update_type": "TRADE_DELIVERED",
                "payload": {"message": description, "village_id": target.id},
            }
        )

    # زمان‌بندی آزاد شدن تاجرها؛ تا آن لحظه ظرفیت تاجر مبدا اشغال باقی می‌ماند
    complete_trade_return.apply_async(args=[trade.id], eta=trade.merchants_return_time)
    return description


@app.task
def complete_trade_return(trade_id):
    """بازگشت تاجرها به دهکده مبدا؛ از این لحظه ظرفیت تاجر مبدا دوباره آزاد می‌شود."""
    ResourceTrade.objects.filter(id=trade_id).update(is_completed=True)
    return f"تاجرهای محموله #{trade_id} به مبدا بازگشتند."


@app.task
def accumulate_culture_points():
    from apps.authentication.models import Player
    from apps.game_engine.models import ServerSetting
    from apps.game_engine.utils import calculate_player_culture_points_per_hour

    settings = ServerSetting.objects.filter(is_active=True).first()
    cp_speed = settings.culture_point_speed if settings else 1

    players = Player.objects.filter(is_active=True).exclude(username__in=["Natars", "Farms"])
    for player in players:
        hourly = calculate_player_culture_points_per_hour(player)
        if hourly <= 0:
            continue
        player.culture_points += hourly * cp_speed
        player.save(update_fields=['culture_points'])