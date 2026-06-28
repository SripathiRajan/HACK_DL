import sqlite3
import csv
import hashlib
from datetime import datetime
import os

DB_PATH = r"c:\Users\USER\Downloads\DriveLegal-main\DriveLegal-main\backend\data\fines.db"
CSV_PATH = r"c:\Users\USER\Downloads\DriveLegal-main\DriveLegal-main\data\Indian_Traffic_Violations.csv"

def generate_version_hash(offence_code, vehicle_class, state, amount_inr):
    payload = f"{offence_code}{vehicle_class}{state}{amount_inr}"
    return hashlib.sha256(payload.encode()).hexdigest()

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    unique_rules = {}

    print(f"Reading from {CSV_PATH}...")
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            offence = row.get("Violation_Type", "").strip()
            v_class = row.get("Vehicle_Type", "").strip()
            state = row.get("Registration_State", "").strip()
            fine = row.get("Fine_Amount", "0").strip()
            
            if not offence or not v_class or not state or not fine.isdigit():
                continue
                
            key = (offence, v_class, state)
            
            # Keep the highest fine for a given violation/vehicle/state combination
            amount = int(fine)
            if key not in unique_rules or unique_rules[key] < amount:
                unique_rules[key] = amount

    print(f"Found {len(unique_rules)} unique traffic rules across states. Inserting...")

    inserted = 0
    now = datetime.now().isoformat()
    
    for (offence, v_class, state), amount in unique_rules.items():
        v_hash = generate_version_hash(offence, v_class, state, amount)
        
        try:
            cursor.execute('''
                INSERT INTO fines (offence_code, vehicle_class, state, amount_inr, repeat_amount_inr, section_ref, source_url, fetched_at, version_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (offence, v_class, state, amount, amount * 2, "Offline-Dataset", "offline_csv", now, v_hash))
            inserted += 1
        except sqlite3.IntegrityError:
            # Skip if already exists
            pass

    conn.commit()
    conn.close()
    
    print(f"Successfully inserted {inserted} offline traffic rules into fines.db!")

if __name__ == "__main__":
    main()
