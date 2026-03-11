import os
import re

def fix_select_calls(directory):
    # Regex to find .select('...') or .select(`...`) or .select("...")
    # This handles multi-line backtick strings as well
    pattern = re.compile(r'(\.select\(\s*[`\'"])(.*?)([`\'"]\s*\))', re.DOTALL)
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                matches = pattern.findall(content)
                for match in matches:
                    prefix, mid, suffix = match
                    # Remove spaces after commas in the mid part
                    # Also remove leading/trailing spaces/newlines in the mid part
                    new_mid = re.sub(r',\s+', ',', mid)
                    new_mid = new_mid.strip()
                    
                    original_call = prefix + mid + suffix
                    new_call = prefix + new_mid + suffix
                    
                    if original_call != new_call:
                        new_content = new_content.replace(original_call, new_call)
                
                if new_content != content:
                    print(f"Fixed {path}")
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_select_calls('src')
