import sqlite3

db_path = 'kitti.db'
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0 NOT NULL")
    conn.commit()
    print("Column is_admin added successfully!")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
