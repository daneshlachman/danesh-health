from datetime import date, timedelta
from flask import current_app

from app import db
from app.models import WeightLog

USER_ID = "00000000-0000-0000-0000-000000000001"


def sync_weight(days: int = 30) -> dict:
    username = current_app.config.get("MFP_USERNAME")
    password = current_app.config.get("MFP_PASSWORD")

    if not username or not password:
        return {"status": "error", "message": "MFP credentials not configured"}

    try:
        import myfitnesspal
        client = myfitnesspal.Client(username, password=password)
    except Exception as e:
        return {"status": "error", "message": f"MFP login failed: {e}"}

    start = date.today() - timedelta(days=days)

    try:
        measurements = client.get_measurements("Weight", lower_bound=start)
    except Exception as e:
        return {"status": "error", "message": f"MFP fetch failed: {e}"}

    saved = 0
    for entry_date, weight_value in measurements.items():
        if weight_value is None:
            continue
        # MFP returns weight in user's preferred unit — assume kg
        # If user uses lbs, convert: weight_kg = weight_value * 0.453592
        weight_kg = round(float(weight_value), 2)

        existing = WeightLog.query.filter_by(
            user_id=USER_ID, date=entry_date, source="mfp"
        ).first()
        if existing:
            existing.weight_kg = weight_kg
        else:
            db.session.add(WeightLog(
                user_id=USER_ID,
                date=entry_date,
                weight_kg=weight_kg,
                source="mfp",
            ))
        saved += 1

    if saved:
        db.session.commit()

    return {"status": "ok", "synced": saved}
