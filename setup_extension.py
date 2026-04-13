# System Imports
import os
import sys
import winreg
import ctypes

# Admin Check
def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

# Registry Configuration
def register_extension():
    if getattr(sys, 'frozen', False):
        app_path = f'"{sys.executable}" "%1"'
    else:
        python_path = sys.executable
        script_path = os.path.abspath("main.py")
        app_path = f'"{python_path}" "{script_path}" "%1"'

    extension = ".tier"
    prog_id = "TierList.Document"
    
    try:
        # File Extension
        with winreg.CreateKey(winreg.HKEY_CLASSES_ROOT, extension) as key:
            winreg.SetValue(key, "", winreg.REG_SZ, prog_id)
            
        # Open Command
        command_key_path = fr"{prog_id}\shell\open\command"
        with winreg.CreateKey(winreg.HKEY_CLASSES_ROOT, command_key_path) as key:
            winreg.SetValue(key, "", winreg.REG_SZ, app_path)
            
        # Windows Update
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0, None, None)
        print(f"Registered {extension}!")
        
    except Exception as e:
        print(f"Error: {e}")

# Entry Point
if __name__ == "__main__":
    if not is_admin():
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
    else:
        register_extension()
        input("Done...")
