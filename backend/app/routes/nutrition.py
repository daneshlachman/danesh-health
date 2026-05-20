from datetime import date
from flask import Blueprint, request, jsonify
from app import db
from app.models import NutritionLog
from app.routes.chat import _ensure_user

nutrition_bp = Blueprint("nutrition", __name__)


@nutrition_bp.route("/nutrition", methods=["GET"])
def get_nutrition():
    user = _ensure_user()
    day_str = request.args.get("date", date.today().isoformat())
    try:
        day = date.fromisoformat(day_str)
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    logs = (
        NutritionLog.query
        .filter_by(user_id=user.id, date=day)
        .order_by(NutritionLog.created_at)
        .all()
    )
    return jsonify([l.to_dict() for l in logs])


@nutrition_bp.route("/nutrition", methods=["POST"])
def post_nutrition():
    user = _ensure_user()
    body = request.get_json(silent=True) or {}

    description = body.get("description", "").strip()
    if not description:
        return jsonify({"error": "description is required"}), 400

    log = NutritionLog(
        user_id=user.id,
        date=body.get("date", date.today().isoformat()),
        meal_type=body.get("meal_type"),
        description=description,
        calories=body.get("calories"),
        protein_g=body.get("protein_g"),
        carbs_g=body.get("carbs_g"),
        fat_g=body.get("fat_g"),
    )
    db.session.add(log)
    db.session.commit()
    return jsonify(log.to_dict()), 201


@nutrition_bp.route("/nutrition/<log_id>", methods=["DELETE"])
def delete_nutrition(log_id):
    user = _ensure_user()
    log = NutritionLog.query.filter_by(id=log_id, user_id=user.id).first_or_404()
    db.session.delete(log)
    db.session.commit()
    return jsonify({"deleted": log_id})
