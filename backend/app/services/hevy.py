"""Hevy REST API integration."""
from datetime import datetime, timezone, timedelta

import requests
from flask import current_app

from app import db
from app.models import Workout

HEVY_API_BASE = "https://api.hevyapp.com/v1"


def _headers():
    return {"api-key": current_app.config["HEVY_API_KEY"]}


def _fetch_workouts(page: int = 1, page_size: int = 10) -> dict:
    resp = requests.get(
        f"{HEVY_API_BASE}/workouts",
        headers=_headers(),
        params={"page": page, "pageSize": page_size},
    )
    resp.raise_for_status()
    return resp.json()


def sync(user_id: str, pages: int = 3) -> dict:
    if not current_app.config.get("HEVY_API_KEY"):
        return {"status": "error", "message": "HEVY_API_KEY not configured"}

    # Pre-load existing Hevy workouts keyed by raw_json["id"]
    existing_map = {
        w.raw_json.get("id"): w
        for w in Workout.query.filter_by(user_id=user_id, source="hevy").all()
        if w.raw_json
    }

    upserted = 0
    try:
        for page in range(1, pages + 1):
            data = _fetch_workouts(page=page, page_size=10)
            workouts = data.get("workouts", [])
            if not workouts:
                break

            for w in workouts:
                workout_id = w.get("id")
                if not workout_id:
                    continue

                start_str = w.get("start_time") or w.get("created_at")
                end_str = w.get("end_time")

                try:
                    start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    workout_date = start_dt.date()
                except (ValueError, AttributeError):
                    continue

                duration = None
                if end_str:
                    try:
                        end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                        duration = int((end_dt - start_dt).total_seconds() / 60)
                    except (ValueError, AttributeError):
                        pass

                existing = existing_map.get(workout_id)
                if existing:
                    existing.title = w.get("title", "Workout")
                    existing.duration_minutes = duration
                    existing.raw_json = w
                    existing.date = workout_date
                else:
                    db.session.add(Workout(
                        user_id=user_id,
                        date=workout_date,
                        source="hevy",
                        title=w.get("title", "Workout"),
                        duration_minutes=duration,
                        raw_json=w,
                    ))
                upserted += 1

        db.session.commit()
    except requests.HTTPError as e:
        body = e.response.text if e.response else ""
        current_app.logger.error(f"Hevy API error: {e} — {body}")
        return {"status": "error", "message": str(e), "detail": body}

    return {"status": "ok", "workouts_synced": upserted}
