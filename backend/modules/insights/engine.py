import sqlite3
import os
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class InsightsEngine:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._check_db()

    def _check_db(self):
        if not os.path.exists(self.db_path):
            logger.warning(f"Insights DB not found at {self.db_path}")

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def get_accident_risk(self, location: str, weather: Optional[str] = None) -> Dict:
        """
        Calculates a risk score for a given location and optional weather
        based on the 'indian_roads_dataset' and 'accident_prediction_india'.
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Query indian_roads_dataset
                query = "SELECT COUNT(*) as accidents, AVG(CAST(risk_score AS FLOAT)) as avg_risk FROM indian_roads_dataset WHERE city LIKE ? OR state LIKE ?"
                params = [f"%{location}%", f"%{location}%"]
                
                if weather:
                    query += " AND weather LIKE ?"
                    params.append(f"%{weather}%")
                    
                cursor.execute(query, params)
                result = cursor.fetchone()
                
                accidents = result[0] if result and result[0] else 0
                avg_risk = result[1] if result and result[1] else 0.0
                
                if accidents == 0:
                    return {
                        "found": False,
                        "location": location,
                        "weather": weather,
                        "message": "No specific accident data found for this location/weather."
                    }
                    
                risk_level = "High" if avg_risk > 0.7 or accidents > 100 else ("Medium" if avg_risk > 0.4 or accidents > 50 else "Low")
                
                return {
                    "found": True,
                    "location": location,
                    "weather": weather,
                    "historical_accidents": accidents,
                    "average_risk_score": round(avg_risk, 2),
                    "risk_level": risk_level,
                    "message": f"Based on historical data, {location} has a {risk_level.lower()} risk level for accidents."
                }
        except Exception as e:
            logger.error(f"Error querying accident risk: {e}")
            return {"error": str(e)}

    def get_violation_stats(self, state: str, vehicle_type: Optional[str] = None) -> Dict:
        """
        Retrieves common violations for a state from 'indian_traffic_violations'.
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                query = "SELECT Violation_Type, COUNT(*) as count FROM indian_traffic_violations WHERE Registration_State LIKE ?"
                params = [f"%{state}%"]
                
                if vehicle_type:
                    query += " AND Vehicle_Type LIKE ?"
                    params.append(f"%{vehicle_type}%")
                    
                query += " GROUP BY Violation_Type ORDER BY count DESC LIMIT 5"
                
                cursor.execute(query, params)
                results = cursor.fetchall()
                
                if not results:
                    return {
                        "found": False,
                        "state": state,
                        "message": "No violation stats found for this state."
                    }
                    
                violations = [{"type": row[0], "count": row[1]} for row in results]
                
                return {
                    "found": True,
                    "state": state,
                    "vehicle_type": vehicle_type,
                    "top_violations": violations
                }
        except Exception as e:
            logger.error(f"Error querying violation stats: {e}")
            return {"error": str(e)}

    def get_nearby_institutions(self, city: str, state: str) -> Dict:
        """
        Retrieves schools and colleges for a city/state to warn about school zones.
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Get schools
                cursor.execute("SELECT name FROM india_schools WHERE city LIKE ? AND state LIKE ? LIMIT 5", (f"%{city}%", f"%{state}%"))
                schools = [row[0] for row in cursor.fetchall()]
                
                # Get colleges
                cursor.execute("SELECT name, type FROM india_colleges WHERE city LIKE ? AND state LIKE ? LIMIT 5", (f"%{city}%", f"%{state}%"))
                colleges = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
                
                if not schools and not colleges:
                    return {
                        "found": False,
                        "city": city,
                        "state": state,
                        "message": "No major schools or colleges found in the database for this area."
                    }
                    
                return {
                    "found": True,
                    "city": city,
                    "state": state,
                    "schools": schools,
                    "colleges": colleges,
                    "warning": "Please drive carefully as there are educational institutions in this area which may be strict speed-limit or no-horn zones."
                }
        except Exception as e:
            logger.error(f"Error querying institutions: {e}")
            return {"error": str(e)}
