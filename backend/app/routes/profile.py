from flask import Blueprint, jsonify, request
from datetime import date, datetime, timezone, timedelta

from app.models import WeightLog, Workout, NutritionLog

profile_bp = Blueprint("profile", __name__)

USER_ID = "00000000-0000-0000-0000-000000000001"

# Hardcoded user profile
HEIGHT_CM = 192
DATE_OF_BIRTH = date(1999, 10, 3)
AVG_DAILY_STEPS = 10000


def _naive(dt: datetime) -> datetime:
    """Strip timezone info for consistent naive UTC comparison."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _workout_window(w: Workout):
    """Return (start_dt, end_dt) as naive UTC datetimes, or (None, None)."""
    raw = w.raw_json or {}
    try:
        if w.source == "garmin":
            start_str = raw.get("startTimeGMT") or raw.get("startTimeLocal", "")
            start = _naive(datetime.fromisoformat(start_str.replace("Z", "+00:00").replace(" ", "T")))
            duration_secs = raw.get("duration") or raw.get("movingDuration") or 0
            return start, start + timedelta(seconds=duration_secs)
        elif w.source == "hevy":
            start_str = raw.get("start_time") or raw.get("created_at", "")
            end_str = raw.get("end_time", "")
            start = _naive(datetime.fromisoformat(start_str.replace("Z", "+00:00")))
            end = _naive(datetime.fromisoformat(end_str.replace("Z", "+00:00")))
            return start, end
        elif w.source == "whoop":
            start = _naive(datetime.fromisoformat(raw["start"].replace("Z", "+00:00")))
            end = _naive(datetime.fromisoformat(raw["end"].replace("Z", "+00:00")))
            return start, end
    except (KeyError, ValueError, TypeError):
        pass
    return None, None


def _overlaps(a_start, a_end, b_start, b_end, tolerance_minutes=10) -> bool:
    if None in (a_start, a_end, b_start, b_end):
        return False
    tol = timedelta(minutes=tolerance_minutes)
    return a_start < b_end + tol and a_end + tol > b_start


WHOOP_STRENGTH_SPORT_IDS = {
    44, 63, 70, 126, 164, 234, 304,  # weightlifting, functional fitness, crossfit, etc.
}


def _calc_workout_kcal(workouts: list, weight_kg: float) -> int:
    """Sum workout calories, deduplicating overlapping sources (Garmin > Hevy > Whoop)."""
    SOURCE_PRIORITY = {"garmin": 0, "hevy": 1, "whoop": 2}

    entries = []
    for w in workouts:
        raw = w.raw_json or {}
        cal = 0
        if w.source == "garmin" and raw.get("calories"):
            cal = raw["calories"]
        elif w.source == "hevy" and w.duration_minutes:
            cal = round(5 * weight_kg * (w.duration_minutes / 60))
        elif w.source == "whoop":
            kj = (raw.get("score") or {}).get("kilojoule")
            if kj:
                cal = round(kj / 4.184)
        if cal:
            start, end = _workout_window(w)
            entries.append((SOURCE_PRIORITY.get(w.source, 9), start, end, cal, w))

    # Sort by priority (lower = higher priority), then suppress time-overlapping lower-priority entries
    entries.sort(key=lambda x: x[0])

    accepted = []
    total = 0
    for priority, start, end, cal, w in entries:
        shadowed = any(
            _overlaps(start, end, a_start, a_end)
            for _, a_start, a_end, _, _ in accepted
        )
        if not shadowed:
            accepted.append((priority, start, end, cal, w))
            total += cal

    return total


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

    # Workout calories today (deduplicated across sources)
    todays_workouts = Workout.query.filter_by(user_id=USER_ID, date=today).all()
    workout_kcal = _calc_workout_kcal(todays_workouts, weight_kg)

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


@profile_bp.route("/calories/history", methods=["GET"])
def calories_history():
    days = int(request.args.get("days", 30))
    today = date.today()
    start = today - timedelta(days=days)

    latest_weight = (
        WeightLog.query.filter_by(user_id=USER_ID)
        .order_by(WeightLog.date.desc()).first()
    )
    weight_kg = latest_weight.weight_kg if latest_weight else 88
    age = (today - DATE_OF_BIRTH).days / 365.25
    bmr = 10 * weight_kg + 6.25 * HEIGHT_CM - 5 * age + 5
    step_kcal = AVG_DAILY_STEPS * 0.04 * (weight_kg / 70)
    tef = bmr * 0.10
    passive_total = round(bmr + step_kcal + tef)

    # Workout calories per day
    workouts = Workout.query.filter(
        Workout.user_id == USER_ID,
        Workout.date >= start,
        Workout.date <= today
    ).all()
    # Group workouts by day, then dedup per day
    workouts_by_day: dict[str, list] = {}
    for w in workouts:
        d = w.date.isoformat()
        workouts_by_day.setdefault(d, []).append(w)
    workout_by_day = {d: _calc_workout_kcal(ws, weight_kg) for d, ws in workouts_by_day.items()}

    # Consumed per day
    nutrition = NutritionLog.query.filter(
        NutritionLog.user_id == USER_ID,
        NutritionLog.date >= start,
        NutritionLog.date <= today
    ).all()
    consumed_by_day = {}
    for n in nutrition:
        d = n.date.isoformat()
        consumed_by_day[d] = consumed_by_day.get(d, 0) + (n.calories or 0)

    result = []
    current = start + timedelta(days=1)
    while current <= today:
        d = current.isoformat()
        workout_kcal = workout_by_day.get(d, 0)
        burned = passive_total + workout_kcal
        consumed = round(consumed_by_day.get(d, 0))
        result.append({
            "date": d,
            "burned": burned,
            "consumed": consumed,
            "balance": consumed - burned if consumed > 0 else None,
        })
        current += timedelta(days=1)

    return jsonify(result)
