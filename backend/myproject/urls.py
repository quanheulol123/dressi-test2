"""
URL configuration for myproject project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.urls import path
from quiz import views

urlpatterns = [
    # HTML pages
    path("login/", views.login_page, name="login"),
    path("signup/", views.signup, name="signup"),
    path("recommend/", views.recommend_page, name="recommend_page"),
    path("quiz/recommend/", views.recommend, name="quiz_recommend"),

    path("segment/", views.upload_and_segment, name="segment"),
    path("api/wardrobe/<str:filename>/", views.delete_wardrobe_item),
    
    # API endpoints
    path("api/get_generated_images/", views.get_generated_images, name="get_generated_images"),
    path("api/login_mongo/", views.login_mongo, name="login_mongo"),  # login API
    path("api/signup_mongo/", views.signup_mongo, name="signup_mongo"),
    path("api/recommend/", views.recommend, name="recommend"),
    path("api/instant_outfits/", views.instant_outfits, name="instant_outfits"),
    path("api/generate/", views.generate_outfits, name="generate_outfits"),
    path("quiz/generate/", views.generate_outfits, name="quiz_generate"),
    path("api/save_image/", views.save_image, name="save_image"),
    path("api/get_wardrobe/", views.get_wardrobe, name="get_wardrobe"),
    path("api/weather_status/", views.weather_status, name="weather_status"),
    path("api/early_access/", views.register_early_access, name="early_access"),
    path("api/early_access/list/", views.list_early_access, name="early_access_list"),
    path("api/early_access/export/", views.export_early_access, name="early_access_export"),
]
