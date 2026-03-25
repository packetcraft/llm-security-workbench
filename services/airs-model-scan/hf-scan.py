"""
hf-scan.py — CLI tool to scan a HuggingFace model using the AIRS Model Security SDK.

Usage:
    python hf-scan.py https://huggingface.co/google/flan-t5-small
    python hf-scan.py google/flan-t5-small   (bare author/model also accepted)

Use this to verify the SDK and credentials are working before starting the sidecar.
"""

import sys
import os
from dotenv import load_dotenv
from model_security_client.api import ModelSecurityAPIClient

load_dotenv()

hf_uuid = os.getenv("SECURITY_GROUP_UUID_HF")

if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("❌ Error: Missing Hugging Face model URL.")
        print("Usage: python3 hf-scan.py <model_url>")
        print("Example: python3 hf-scan.py https://huggingface.co/username/modelname")
        sys.exit(1)

    target_model_uri = sys.argv[1]

    # Accept bare author/model-name and normalise to full URL
    if not target_model_uri.startswith("http"):
        target_model_uri = f"https://huggingface.co/{target_model_uri}"

    client = ModelSecurityAPIClient(
        base_url="https://api.sase.paloaltonetworks.com/aims"
    )

    print(f"🚀 Initiating scan for: {target_model_uri}")

    try:
        result = client.scan(
            security_group_uuid=hf_uuid,
            model_uri=target_model_uri
        )
        print(f"Scan completed: {result.eval_outcome}\n")
        print(result.model_dump_json(indent=2))

    except Exception as e:
        print(f"⚠️ An error occurred: {e}")
