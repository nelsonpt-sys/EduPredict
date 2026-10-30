from django.urls import path

from reservasAPP.views import SignUpView

urlpatterns = [
    path("signup/", SignUpView.as_view(), name="signup")
    ]