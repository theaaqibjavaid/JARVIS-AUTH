"""Pytest configuration — ensures vendored dependencies and test DB are ready."""
import sys
import os

# Add vendored packages to path so sqlmodel and bcrypt can be imported
VENDOR_DIR = os.path.join(os.path.dirname(__file__), "vendor")
if VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)
