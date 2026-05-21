from flask import Blueprint, jsonify, request
from datetime import date, datetime, timezone

from app.models import WeightLog, Workout, NutritionLog

profile_bp = Blueprint("profile", __name__)

USER_ID = "00000000-0000-0000-0000-000000000001"

# Hardcoded user profile
HEIGHT_CM = 192
DATE_OF_BIRTH = date(1999, 10, 3)
AVG_DAILY_STEPS = 10000


@profile_bp.route("/tdee/today", methods=["GET"])
def tdee_today():
    date_str = request.args.get("date")
    today = date.fromisoformat(date_str) if date_str else date.today()

    latest_weight = (
        WeightLog.query.filter_by(user_id=USER_ID)
        .order_by(WeightLog.date.desc()).first()
    )
    weight_kg = latest_weight.weight_kg if latest_weight else 88

    age = (today - DATE_OF_BIRTH).days / 365.25
    bmr = 10 * weight_kg + 6.25 * HEIGHT_CM - 5 * age + 5
    step_kcal = AVG_DAILY_STEPS * 0.04 * (weight_kg / 70)
    tef = bmr * 0.10
    passive_total = bmr + step_kcal + tef

    # Workout calories today
    todays_workouts = Workout.query.filter_by(user_id=USER_ID, date=today).all()
    workout_kcal = 0
    for w in todays_workouts:
        raw = w.raw_json or {}
        if w.source == "garmin" and raw.get("calories"):
            workout_kcal += raw["calories"]
        elif w.source == "hevy" and w.duration_minutes:
            workout_kcal += round(5 * weight_kg * (w.duration_minutes / 60))

    tdee = round(passive_total + workout_kcal)

    # For past days show full TDEE; for today scale by time of day
    is_today = today == date.today()
    if is_today:
        now = datetime.now(timezone.utc).astimezone()
        minutes_elapsed = now.hour * 60 + now.minute
        time_fraction = minutes_elapsed / (24 * 60)
        burned_now = round(time_fraction * passive_total + workout_kcal)
    else:
        burned_now = tdee

    # Today's consumed calories
    nutrition = NutritionLog.query.filter_by(user_id=USER_ID, date=today).all()
    consumed = round(sum(n.calories or 0 for n in nutrition))
    balance = consumed - burned_now  # positive = surplus, negative = deficit

    return jsonify({
        "tdee": tdee,
        "burned_now": burned_now,
        "bmr": round(bmr),
        "step_kcal": round(step_kcal),
        "workout_kcal": round(workout_kcal),
        "consumed": consumed,
        "balance": balance,
        "weight_kg": weight_kg,
    })
