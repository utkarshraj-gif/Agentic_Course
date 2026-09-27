# backend/services/risk_engine_service.py
# Deterministic, Data-Driven Enterprise Learner Risk Engine

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class RiskEngineService:
    @staticmethod
    def calculate_learner_risk(learner_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Computes a deterministic, explainable risk score (0-100) and operational status.
        Factors:
          - Inactivity days
          - Progress vs expected milestone
          - Quiz/Assessment score average
          - Dropped labs or incomplete capstones
        """
        reasons = []
        score = 0

        # 1. Inactivity Factor
        last_active = str(learner_data.get("last_active", "")).lower()
        if "day" in last_active:
            try:
                days_num = int(''.join(filter(str.isdigit, last_active)) or 1)
                if days_num >= 7:
                    score += 40
                    reasons.append(f"No learning activity recorded for {days_num} days (threshold > 7 days)")
                elif days_num >= 3:
                    score += 15
                    reasons.append(f"Inactive for {days_num} days")
            except Exception:
                pass
        elif "week" in last_active or "month" in last_active:
            score += 50
            reasons.append("Inactive for over 1 week")

        # 2. Assessment Performance
        quiz_avg = float(learner_data.get("quiz_avg", 85) or 0)
        if quiz_avg > 0 and quiz_avg < 70:
            score += 35
            reasons.append(f"Assessment average is {quiz_avg}% (below 70% proficiency gate)")
        elif quiz_avg >= 70 and quiz_avg < 80:
            score += 15
            reasons.append(f"Assessment average is {quiz_avg}% (borderline 70-80% band)")

        # 3. Completion Progress vs Target
        completed_classes = len(learner_data.get("completed_classes", []))
        total_classes = 15
        completion_pct = round((completed_classes / total_classes) * 100, 1)

        # Expected milestone for active cohorts is at least 6 classes (40%)
        expected_pct = 40.0
        if completion_pct < 25.0:
            score += 30
            reasons.append(f"Pacing is {round(expected_pct - completion_pct)}% behind target cohort milestone ({completed_classes}/15 classes)")
        elif completion_pct < expected_pct:
            score += 15
            reasons.append(f"Behind schedule ({completed_classes}/15 classes completed)")

        # 4. Capstone Engagement
        capstones = learner_data.get("capstones", [])
        if completed_classes >= 8 and len(capstones) == 0:
            score += 15
            reasons.append("Eligible for enterprise capstone but not yet started")

        # Cap score at 100
        score = min(100, score)

        if score >= 60:
            status = "at_risk"
            rec = "Send proactive intervention & schedule mentor review"
        elif score >= 25:
            status = "on_track"
            rec = "Monitor progress on next milestone assessment"
        else:
            status = "ahead"
            rec = "Eligible for fast-track enterprise certification"

        return {
            "status": status,
            "risk_score": score,
            "reasons": reasons,
            "completion_pct": completion_pct,
            "quiz_avg": quiz_avg,
            "recommendation": rec
        }

    @classmethod
    def get_at_risk_overview(cls, learners: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Produces aggregated risk telemetry across the enterprise roster."""
        at_risk = []
        on_track = []
        ahead = []

        reasons_tally = {
            "inactive_over_7_days": 0,
            "low_assessment_score": 0,
            "behind_schedule": 0,
        }

        all_learners = []
        for l in learners:
            risk = cls.calculate_learner_risk(l)
            enriched = {**l, "risk": risk}
            
            # Extract inactive days
            last_active = str(l.get("last_active", "")).lower()
            days_num = 0
            if "day" in last_active:
                try:
                    days_num = int(''.join(filter(str.isdigit, last_active)) or 1)
                except Exception:
                    days_num = 1
            elif "week" in last_active or "month" in last_active:
                days_num = 14

            learner_summary = {
                "user_id": l.get("id"),
                "user_name": l.get("name"),
                "user_email": l.get("email"),
                "cohort": l.get("cohort"),
                "risk_score": risk.get("risk_score", 0),
                "status": risk.get("status", "on_track"),
                "reasons": risk.get("reasons", []),
                "inactive_days": days_num,
                "progress_gap": max(0, 40 - int(risk.get("completion_pct", 0))),
                "avg_score": risk.get("quiz_avg", 80),
                "updated_at": l.get("last_active", "")
            }
            all_learners.append(learner_summary)

            if risk["status"] == "at_risk":
                at_risk.append(enriched)
                for r in risk["reasons"]:
                    if "inactive" in r.lower() or "no learning activity" in r.lower():
                        reasons_tally["inactive_over_7_days"] += 1
                    if "assessment" in r.lower():
                        reasons_tally["low_assessment_score"] += 1
                    if "behind" in r.lower():
                        reasons_tally["behind_schedule"] += 1
            elif risk["status"] == "on_track":
                on_track.append(enriched)
            else:
                ahead.append(enriched)

        return {
            "total_analyzed": len(learners),
            "total_evaluated": len(learners),
            "at_risk_count": len(at_risk),
            "on_track_count": len(on_track),
            "ahead_count": len(ahead),
            "critical_inactivity_count": reasons_tally["inactive_over_7_days"],
            "behind_schedule_count": reasons_tally["behind_schedule"],
            "failing_assessments_count": reasons_tally["low_assessment_score"],
            "reasons_tally": reasons_tally,
            "at_risk_learners": at_risk,
            "learners": all_learners
        }
