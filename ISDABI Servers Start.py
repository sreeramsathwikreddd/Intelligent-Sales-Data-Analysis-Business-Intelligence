import subprocess
import sys
import time
import socket
from pathlib import Path

PROJECT_ROOT = Path(r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence")
FRONTEND_DIR = PROJECT_ROOT / "ISDABI Frontend"
BACKEND_DIR = PROJECT_ROOT / "ISDABI Backend"
AI_DIR = PROJECT_ROOT / "ISDABI AI ML"
AI_PYTHON = AI_DIR / ".venv" / "Scripts" / "python.exe"

def is_port_open(host, port):
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except (ConnectionRefusedError, TimeoutError, OSError):
        return False

def start_server(directory, command):
    return subprocess.Popen(
        command,
        cwd=str(directory),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW
    )

def main():
    print("ISDABI - ALL SERVERS STARTING SOON")
    print()

    required = [FRONTEND_DIR, BACKEND_DIR, AI_DIR, AI_PYTHON]

    for path in required:
        if not path.exists():
            print("Required path not found:")
            print(path)
            sys.exit(1)

    processes = []

    try:
        if not is_port_open("127.0.0.1", 8000):
            processes.append((
                "AI API",
                start_server(
                    AI_DIR,
                    [
                        str(AI_PYTHON),
                        r".\api\ISDABI AI API.py"
                    ]
                )
            ))
            time.sleep(2)

        processes.append((
            "BACKEND",
            start_server(
                BACKEND_DIR,
                [
                    "node",
                    r".\ISDABI Backend Server.js"
                ]
            )
        ))
        time.sleep(2)

        processes.append((
            "FRONTEND",
            start_server(
                FRONTEND_DIR,
                [
                    "node",
                    r".\node_modules\vite\bin\vite.js",
                    "--host",
                    "localhost",
                    "--port",
                    "5173"
                ]
            )
        ))

        print("ALL SERVERS ARE STARTED YOU CAN USE THE PROJECT USING THIS URL - ( http://localhost:5173 )")
        print()
        print("=" * 70)
        print("                 ISDABI SERVERS RUNNING")
        print("=" * 70)

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        pass

    finally:
        for name, process in processes:
            if process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        process.kill()
                    except Exception:
                        pass
                except Exception:
                    pass

        print()
        print("=" * 70)
        print("     ALL ISDABI SERVERS STOPPED TO USE RESTART ALL THE SERVERS")
        print("=" * 70)

if __name__ == "__main__":
    main()
