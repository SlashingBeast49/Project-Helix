"""
Project Helix — Dataset Builder Script.

Executes the JSON -> DataFrame -> 15 Features -> Validation -> CSV pipeline.
"""

import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.dataset import main

if __name__ == "__main__":
    main()
