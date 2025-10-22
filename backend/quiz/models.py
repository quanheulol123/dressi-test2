# quiz/models.py
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

class OutfitCache(models.Model):
    query = models.CharField(max_length=255, unique=True)
    image = models.CharField(max_length=500)
    tags = models.JSONField(default=list)  # <- JSONField handles lists properly
    created_at = models.DateTimeField(auto_now_add=True)

from django.utils import timezone
from datetime import timedelta

def prune_old_outfits(days=30):
    cutoff = timezone.now() - timedelta(days=days)
    OutfitCache.objects.filter(created_at__lt=cutoff).delete()

class Item(models.Model):
    name = models.CharField(max_length=255)
    image = models.URLField()
    tags = models.JSONField(default=list)  # optional tags
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wardrobe_items")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name