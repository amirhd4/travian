from apps.authentication.models import Player
from .models import Village, ServerSetting
from .services import _find_free_coordinates, _create_resource_fields_only

# تولید پایه‌ی هر مزرعه در سطح ۲۰ (بر ساعت)، قبل از اعمال ضریب ادمین
BASE_LEVEL_20_PRODUCTION = 340


def spawn_farm_villages():
    settings = ServerSetting.objects.filter(is_active=True).first()
    count = settings.farm_village_count if settings else 20
    production = settings.farm_production_per_hour if settings else 1000000

    farm_owner, _ = Player.objects.get_or_create(
        username="Farms", email="farms@game.com", defaults={"tribe": "ROMAN"}
    )

    for i in range(count):
        x, y = _find_free_coordinates()
        village = Village.objects.create(
            player=farm_owner,
            name=f"مزرعه ({x}|{y})",
            x_coord=x, y_coord=y,
            is_capital=False,
            is_farm_village=True,
            loyalty=100,
            wood=999999, clay=999999, iron=999999, crop=999999,
            prod_wood=production, prod_clay=production,
            prod_iron=production, prod_crop=production,
            max_storage=999999, max_granary=999999,
        )
        _create_resource_fields_only(village)