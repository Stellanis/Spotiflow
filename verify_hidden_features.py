import requests
import sys

API_URL = "http://localhost:8000/settings"

def test_hidden_features():
    print("Fetching current settings...")
    try:
        response = requests.get(API_URL)
        response.raise_for_status()
        original_settings = response.json()
        print(f"Original hidden features: {original_settings.get('HIDDEN_FEATURES')}")
    except Exception as e:
        print(f"Failed to fetch settings: {e}")
        return False

    print("\nSetting hidden features to 'jobs,stats'...")
    try:
        payload = {"hidden_features": "jobs,stats"}
        response = requests.post(API_URL, json=payload)
        response.raise_for_status()
        print("Settings updated.")
    except Exception as e:
        print(f"Failed to update settings: {e}")
        return False

    print("\nVerifying update...")
    try:
        response = requests.get(API_URL)
        response.raise_for_status()
        new_settings = response.json()
        print(f"New hidden features: {new_settings.get('HIDDEN_FEATURES')}")
        
        if new_settings.get('HIDDEN_FEATURES') == "jobs,stats":
            print("SUCCESS: Hidden features updated correctly.")
        else:
            print("FAILURE: Hidden features mismatch.")
            return False
            
    except Exception as e:
        print(f"Failed to verify settings: {e}")
        return False

    print("\nReverting settings...")
    try:
        original_val = original_settings.get('HIDDEN_FEATURES')
        # If original was None, we send empty string or handle it, but API expects string or None?
        # My code uses `if settings.hidden_features is not None`. So if I send empty string it sets empty string.
        # If I send None, it doesn't update.
        # Let's send what we got, defaulting to "" if None
        payload = {"hidden_features": original_val if original_val is not None else ""}
        
        # Actually if I send None (null in json), pydantic model default is None, so logic skips it.
        # But wait, I want to Clear it if it was empty.
        # If original was None or "", I want to restore that.
        # If I send "", it will be saved as "".
        
        requests.post(API_URL, json=payload)
        print("Settings reverted.")
    except Exception as e:
        print(f"Failed to revert settings: {e}")

    return True

if __name__ == "__main__":
    if test_hidden_features():
        sys.exit(0)
    else:
        sys.exit(1)
