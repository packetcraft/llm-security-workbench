"""
local-scan.py — CLI tool to scan a local model directory using the AIRS Model Security SDK.

Usage:
    python local-scan.py /path/to/model

Requires SECURITY_GROUP_UUID_LOCAL in .env (separate UUID from the HuggingFace security group).
Use this to verify local scanning works before wiring it to the sidecar.
"""

import sys
import os
from dotenv import load_dotenv
from model_security_client.api import ModelSecurityAPIClient

load_dotenv()

local_uuid = os.getenv("SECURITY_GROUP_UUID_LOCAL")

if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("❌ Error: Missing model path.")
        print("Usage: python3 local-scan.py <path_to_model>")
        print("Example: python3 local-scan.py /Users/name/models/my-model")
        sys.exit(1)

    user_model_path = sys.argv[1]

    if not os.path.exists(user_model_path):
        print(f"❌ Error: The path '{user_model_path}' does not exist.")
        sys.exit(1)

    print(f"✅ Scanning model at: {user_model_path}")

    client = ModelSecurityAPIClient(
        base_url="https://api.sase.paloaltonetworks.com/aims"
    )

    try:
        result = client.scan(
            security_group_uuid=local_uuid,
            model_path=user_model_path
        )
        print(f"Scan completed: {result.eval_outcome}\n")
        print(result.model_dump_json(indent=2))

    except Exception as e:
        print(f"An error occurred during scanning: {e}")
