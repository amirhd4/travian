from django.contrib import admin
from .models import WorldWonder

@admin.register(WorldWonder)
class WorldWonderAdmin(admin.ModelAdmin):
    list_display = ('village', 'level', 'last_upgraded')
    search_fields = ('village__name', 'village__player__email')