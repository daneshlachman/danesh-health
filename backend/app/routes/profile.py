from flask import Blueprint, request, jsonify
from datetime import date as date_type

from app import db
from app.models import UserProfile, User

profile_bp = Blueprint("profile", __name__)

USER_ID = "00000000-0000-0000-0000-000000000001"


def _get_or_create_profile():
    profile = UserProfile.query.filter_by(user_id=USER_ID).first()
    if not profile:
        profile = UserProfile(user_id=USER_ID)
        db.session.add(profile)
        db.session.commit()
    return profile


@profile_bp.route("/profile", methods=["GET"])
def get_profile():
    return jsonify(_get_or_create_profile().to_dict())


@profile_bp.route("/profile", methods=["POST"])
def save_profile():
    data = request.get_json()
    profile = _get_or_create_profile()

    if "height_cm" in data:
        profile.height_cm = data["height_cm"]
    if "date_of_birth" in data and data["date_of_birth"]:
        profile.date_of_birth = date_type.fromisoformat(data["date_of_birth"])
    if "gender" in data:
        profile.gender = data["gender"]
    if "avg_daily_steps" in data:
        profile.avg_daily_steps = data["avg_daily_steps"]

    db.session.commit()
    return jsonify(profile.to_dict())
