from apps.authentication.models import Player
from apps.game_engine.models import Village

def spawn_natar_tribe():
    natar_user, created = Player.objects.get_or_create(username="Natars", email="natars@game.com")
    Village.objects.get_or_create(
        player=natar_user,
        name="Natar Capital",
        x_coord=0,
        y_coord=0
    )

def spawn_ww_building_plans():
    # پیدا کردن ۵۰ بازیکن برتر سرور (به‌عنوان مثال بر اساس بیشترین طلا یا جمعیت)
    top_players = Player.objects.filter(is_active=True).exclude(username="Natars").order_by('-gold_coins')[:50]
    for player in top_players:
        player.has_ww_plan = True
        player.save()