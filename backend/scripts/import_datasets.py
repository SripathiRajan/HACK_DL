import sqlite3
import csv
import os
import sys

# Setup paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DB_PATH = os.path.join(PROJECT_ROOT, "backend", "data", "insights.db")

def create_table_from_csv(cursor, table_name, csv_path):
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        return

    print(f"Importing {csv_path} into {table_name}...")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            return

        # Clean headers to valid SQLite column names
        clean_headers = [h.strip().replace(' ', '_').replace('/', '_').replace('-', '_').replace('(', '').replace(')', '').replace('.', '') for h in headers]
        
        # Create table
        columns = ", ".join([f'"{h}" TEXT' for h in clean_headers])
        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
        cursor.execute(f"CREATE TABLE {table_name} ({columns})")

        # Insert data
        columns_str = ", ".join([f'"{h}"' for h in clean_headers])
        values_str = ", ".join(['?' for _ in clean_headers])
        insert_query = f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str})"
        
        batch = []
        for row in reader:
            if len(row) != len(clean_headers):
                # pad or truncate row to match headers
                row = (row + [''] * len(clean_headers))[:len(clean_headers)]
            batch.append(row)
            
            if len(batch) >= 5000:
                cursor.executemany(insert_query, batch)
                batch = []
        
        if batch:
            cursor.executemany(insert_query, batch)
    print(f"Finished {table_name}")

def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    datasets = [
        ("road_accident_dataset", "road_accident_dataset.csv"),
        ("indian_roads_dataset", "indian_roads_dataset.csv"),
        ("accident_prediction_india", "accident_prediction_india.csv"),
        ("indian_traffic_violations", "Indian_Traffic_Violations.csv"),
        ("echallan_daily_data", "echallan_daily_data.csv"),
        ("india_cities", "india_cities.csv"),
        ("india_colleges", "india_colleges.csv"),
        ("india_schools", "india_schools.csv")
    ]

    for table_name, file_name in datasets:
        csv_path = os.path.join(DATA_DIR, file_name)
        create_table_from_csv(cursor, table_name, csv_path)

    conn.commit()
    conn.close()
    print(f"Database successfully created at {DB_PATH}")

if __name__ == "__main__":
    main()
