"""Whoop OAuth 2.0 integration and data sync."""
import os
from datetime import datetime, timezone, timedelta, date

import requests
from flask import current_app

from app import db
from app.models import OAuthToken, WhoopData, WeightLog, Workout, User

# Whoop sport IDs → category for frontend display
# https://developer.whoop.com/docs/developing/data-models/workout
STRENGTH_SPORT_IDS = {
    44,   # Weightlifting
    63,   # Functional Fitness
    70,   # CrossFit
    126,  # Powerlifting
    164,  # Olympic Weightlifting
    234,  # Strength Training
    304,  # Bodybuilding
}

CYCLING_SPORT_IDS = {
    2,    # Cycling
    71,   # Mountain Biking
    287,  # Road Cycling
    288,  # Indoor Cycling
    289,  # BMX
}

# sport_id 0 = unlabeled Activity — skip these
SKIP_SPORT_IDS = {0, -1}

SPORT_NAMES = {
    1: "Running", 2: "Cycling", 51: "Swimming", 57: "Football",
    63: "Functional Fitness", 70: "CrossFit", 71: "Mountain Biking",
    74: "Tennis", 82: "Yoga", 93: "Basketball", 96: "Soccer",
    126: "Powerlifting", 164: "Olympic Weightlifting", 170: "HIIT",
    176: "Rowing", 234: "Strength Training", 287: "Road Cycling",
    288: "Indoor Cycling", 289: "BMX", 304: "Bodybuilding",
    44: "Weightlifting",
}

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2"

SCOPES = "offline read:recovery read:sleep read:body_measurement read:cycles read:workout"


def get_auth_url(redirect_uri: str, client_id: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": "whoop_auth",
    }
    query = "&".join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
    return f"{WHOOP_AUTH_URL}?{query}"


def exchange_code(code: str, user_id: str) -> dict:
    client_id = current_app.config["WHOOP_CLIENT_ID"]
    client_secret = current_app.config["WHOOP_CLIENT_SECRET"]
    redirect_uri = current_app.config["WHOOP_REDIRECT_URI"]

    resp = requests.post(WHOOP_TOKEN_URL, data={
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    })
    resp.raise_for_status()
    data = resp.json()
    _save_token(user_id, data)
    return data


def _save_token(user_id: str, token_data: dict):
    expires_in = token_data.get("expires_in", 3600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    token = OAuthToken.query.filter_by(user_id=user_id, provider="whoop").first()
    if token:
        token.access_token = token_data["access_token"]
        token.refresh_token = token_data.get("refresh_token", token.refresh_token)
        token.expires_at = expires_at
        token.updated_at = datetime.now(timezone.utc)
    else:
        token = OAuthToken(
            user_id=user_id,
            provider="whoop",
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            expires_at=expires_at,
        )
        db.session.add(token)
    db.session.commit()


def _get_valid_token(user_id: str) -> str | None:
    token = OAuthToken.query.filter_by(user_id=user_id, provider="whoop").first()
    if not token:
        return None

    # Refresh if expiring within 5 minutes
    if token.expires_at and token.expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5):
        try:
            resp = requests.post(WHOOP_TOKEN_URL, data={
                "grant_type": "refresh_token",
                "refresh_token": token.refresh_token,
                "client_id": current_app.config["WHOOP_CLIENT_ID"],
                "client_secret": current_app.config["WHOOP_CLIENT_SECRET"],
            })
            resp.raise_for_status()
            _save_token(user_id, resp.json())
            token = OAuthToken.query.filter_by(user_id=user_id, provider="whoop").first()
        except Exception as e:
            current_app.logger.error(f"Whoop token refresh failed: {e}")
            return None

    return token.access_token


def _api_get(access_token: str, path: str, params: dict = None) -> dict:
    resp = requests.get(
        f"{WHOOP_API_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params or {},
    )
    resp.raise_for_status()
    return resp.json()


def _fetch_all_pages(access_token: str, path: str, params: dict = None) -> list:
    records = []
    p = dict(params or {})
    while True:
        data = _api_get(access_token, path, p)
        records.extend(data.get("records", []))
        next_token = data.get("next_token")
        if not next_token:
            break
        p["nextToken"] = next_token
    return records


def is_connected(user_id: str) -> bool:
    return OAuthToken.query.filter_by(user_id=user_id, provider="whoop").first() is not None


def sync(user_id: str) -> dict:
    access_token = _get_valid_token(user_id)
    if not access_token:
        return {"status": "error", "message": "Whoop not connected"}

    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")
    end = now.strftime("%Y-%m-%dT23:59:59Z")

    try:
        recovery_records = _fetch_all_pages(access_token, "/recovery", {"start": start, "end": end})
        sleep_records = _fetch_all_pages(access_token, "/activity/sleep", {"start": start, "end": end})
    except requests.HTTPError as e:
        body = e.response.text if e.response is not None else ""
        current_app.logger.error(f"Whoop API error: {e} — {body}")
        return {"status": "error", "message": str(e), "detail": body}

    # Build a date → data map from recovery
    day_map: dict[date, dict] = {}
    for r in recovery_records:
        if r.get("score_state") != "SCORED":
            continue
        score = r.get("score", {})
        try:
            d = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")).date()
        except (KeyError, ValueError):
            continue
        day_map.setdefault(d, {})
        day_map[d].update({
            "recovery_score": score.get("recovery_score"),
            "hrv_ms": score.get("hrv_rmssd_milli"),
            "resting_hr": score.get("resting_heart_rate"),
            "raw": r,
        })

    # Merge sleep into the same date map
    for s in sleep_records:
        if s.get("score_state") != "SCORED" or s.get("nap"):
            continue
        score = s.get("score", {})
        try:
            d = datetime.fromisoformat(s["end"].replace("Z", "+00:00")).date()
        except (KeyError, ValueError):
            continue
        start_dt = datetime.fromisoformat(s["start"].replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(s["end"].replace("Z", "+00:00"))
        duration_hours = (end_dt - start_dt).total_seconds() / 3600

        day_map.setdefault(d, {})
        day_map[d].update({
            "sleep_score": score.get("sleep_performance_percentage"),
            "sleep_duration_hours": round(duration_hours, 2),
        })

    # Upsert into whoop_data
    upserted = 0
    for d, values in day_map.items():
        existing = WhoopData.query.filter_by(user_id=user_id, date=d).first()
        if existing:
            for k, v in values.items():
                if k != "raw" and v is not None:
                    setattr(existing, k, v)
            if "raw" in values:
                existing.raw_json = values["raw"]
        else:
            existing = WhoopData(
                user_id=user_id,
                date=d,
                recovery_score=values.get("recovery_score"),
                hrv_ms=values.get("hrv_ms"),
                resting_hr=values.get("resting_hr"),
                sleep_score=values.get("sleep_score"),
                sleep_duration_hours=values.get("sleep_duration_hours"),
                raw_json=values.get("raw"),
            )
            db.session.add(existing)
        upserted += 1

    # Also sync body weight from Whoop
    weight_synced = 0
    try:
        body = _api_get(access_token, "/body/measurement")
        weight_kg = body.get("weight")
        if weight_kg:
            today = now.date()
            existing_weight = WeightLog.query.filter_by(user_id=user_id, date=today, source="whoop").first()
            if not existing_weight:
                db.session.add(WeightLog(
                    user_id=user_id,
                    date=today,
                    weight_kg=weight_kg,
                    source="whoop",
                ))
                weight_synced = 1
    except Exception:
        pass

    # Sync Whoop workouts
    workouts_synced = 0
    try:
        workout_records = _fetch_all_pages(access_token, "/activity/workout", {"start": start, "end": end})
        existing_whoop_ids = {
            w.raw_json.get("id"): w
            for w in Workout.query.filter_by(user_id=user_id, source="whoop").all()
            if w.raw_json
        }
        for wo in workout_records:
            wo_id = wo.get("id")
            if not wo_id:
                continue
            sport_id = wo.get("sport_id", 0)
            sport_name = wo.get("sport_name", "").lower()
            SKIP_SPORT_NAMES = {"activity", "walking", "commuting"}
            if sport_name in SKIP_SPORT_NAMES or sport_id in SKIP_SPORT_IDS:
                continue
            # Capitalize for display
            display_name = sport_name.replace("_", " ").title() if sport_name else f"Sport {sport_id}"
            try:
                start_dt = datetime.fromisoformat(wo["start"].replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(wo["end"].replace("Z", "+00:00"))
                duration = int((end_dt - start_dt).total_seconds() / 60)
                # Use timezone_offset to get the correct local date
                tz_str = wo.get("timezone_offset", "+00:00")
                sign = 1 if tz_str[0] != "-" else -1
                tz_parts = tz_str.lstrip("+-").split(":")
                tz_delta = timedelta(
                    hours=int(tz_parts[0]) * sign,
                    minutes=int(tz_parts[1]) * sign if len(tz_parts) > 1 else 0,
                )
                wo_date = (start_dt + tz_delta).date()
            except (KeyError, ValueError):
                continue

            existing = existing_whoop_ids.get(wo_id)
            if existing:
                existing.title = display_name
                existing.duration_minutes = duration
                existing.raw_json = wo
                existing.date = wo_date
            else:
                db.session.add(Workout(
                    user_id=user_id,
                    date=wo_date,
                    source="whoop",
                    title=display_name,
                    duration_minutes=duration,
                    raw_json=wo,
                ))
            workouts_synced += 1
    except Exception as e:
        current_app.logger.warning(f"Whoop workout sync failed: {e}")

    db.session.commit()
    return {
        "status": "ok",
        "days_synced": upserted,
        "weight_synced": weight_synced,
        "workouts_synced": workouts_synced,
    }
