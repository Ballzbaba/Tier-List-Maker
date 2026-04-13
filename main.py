# Core Imports
import webview
import os
import sys
import json
import base64
import mimetypes

# Resource Pathing
def get_resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# Backend API
class Api:
    def __init__(self, window):
        self._window = window
        self._current_path = None
        self.img_folder = os.path.join(os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else "."), "Tier List Dependencies/images")
        if not os.path.exists(self.img_folder):
            os.makedirs(self.img_folder)

    def path_to_base64(self, path):
        try:
            if not os.path.exists(path): return None
            mime_type, _ = mimetypes.guess_type(path)
            if not mime_type: mime_type = "image/png"
            with open(path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
                return f"data:{mime_type};base64,{encoded}"
        except Exception as e:
            print(f"Error: {e}")
            return None

    def select_images(self):
        file_types = ('Image Files (*.png;*.jpg;*.jpeg;*.webp;*.gif)', 'All files (*.*)')
        result = self._window.create_file_dialog(webview.FileDialog.OPEN, allow_multiple=True, file_types=file_types)
        if not result: return []
        paths = result if isinstance(result, (list, tuple)) else [result]
        return [self.path_to_base64(p) for p in paths if p]

    def get_images(self):
        if not os.path.exists(self.img_folder):
            return []
        valid_exts = ('.png', '.jpg', '.jpeg', '.webp', '.gif')
        paths = [os.path.abspath(os.path.join(self.img_folder, f)) for f in os.listdir(self.img_folder) if f.lower().endswith(valid_exts)]
        return [self.path_to_base64(p) for p in paths]

    def save_tier_list(self, data, save_as=False):
        if not save_as and self._current_path:
            save_path = self._current_path
        else:
            file_types = ('Tier List (*.tier)', 'All files (*.*)')
            result = self._window.create_file_dialog(webview.FileDialog.SAVE, file_types=file_types, save_filename='my_list.tier')
            if not result: return False
            save_path = result[0] if isinstance(result, (list, tuple)) else result
            if not save_path: return False
            if not save_path.lower().endswith('.tier'): save_path += '.tier'
            self._current_path = save_path
        try:
            with open(save_path, 'w') as f:
                json.dump(data, f, indent=4)
            return True
        except Exception as e:
            print(f"Error: {e}")
            return False

    def load_tier_list(self):
        file_types = ('Tier List (*.tier)', 'All files (*.*)')
        result = self._window.create_file_dialog(webview.FileDialog.OPEN, file_types=file_types)
        if not result: return None
        load_path = result[0] if isinstance(result, (list, tuple)) else result
        self._current_path = load_path
        try:
            with open(load_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error: {e}")
            return None

    def get_startup_file(self):
        if len(sys.argv) > 1:
            path = sys.argv[1]
            if path.endswith('.tier') and os.path.exists(path):
                self._current_path = path
                try:
                    with open(path, 'r') as f:
                        return json.load(f)
                except Exception as e:
                    print(f"Error: {e}")
        return None

# API Proxy
class ApiProxy:
    def __init__(self):
        self.api = None
    def select_images(self): return self.api.select_images()
    def get_images(self): return self.api.get_images()
    def save_tier_list(self, data, save_as=False): return self.api.save_tier_list(data, save_as)
    def load_tier_list(self): return self.api.load_tier_list()
    def get_startup_file(self): return self.api.get_startup_file()

# App Window
html_path = get_resource_path('index.html')
proxy = ApiProxy()
window = webview.create_window(
    'Local Tier Maker',
    html_path,
    js_api=proxy,
    width=1000,
    height=800,
)
proxy.api = Api(window)

# Application Entry
if __name__ == '__main__':
    webview.start(gui='edgechromium')
