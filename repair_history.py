import subprocess
import re
from concurrent.futures import ThreadPoolExecutor

def repair_one(mid):
    print(f"Repairing {mid}...")
    subprocess.run(['npx', 'supabase', 'migration', 'repair', '--status', 'applied', mid], capture_output=True)

def repair_history():
    log_file = 'push_repair.txt'
    with open(log_file, 'r') as f:
        content = f.read()
    
    ids = re.findall(r'\d{14}', content)
    unique_ids = sorted(list(set(ids)))
    
    print(f"Found {len(unique_ids)} migration IDs to repair. Using 20 threads.")
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        executor.map(repair_one, unique_ids)

if __name__ == "__main__":
    repair_history()
