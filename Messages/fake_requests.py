import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from faker import Faker
import random

fake = Faker()

# Endpoint configuration
URL = "https://ibang-middlewareqa.ibang.ai/api/v1.0/Webhook/D360?access_key=DbFLPlivbTPss_wxR9r53g"
HEADERS = {
    "Content-Type": "application/json"
}

# Load contacts from file
def load_contacts(filename='fake_contacts.txt'):
    """Load contacts from the text file"""
    contacts = []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    phone, name = line.split(',')
                    contacts.append({'phone': phone, 'name': name})
        print(f"✓ Loaded {len(contacts)} contacts from {filename}")
    except FileNotFoundError:
        print(f"✗ Error: {filename} not found. Please run generate_fake_contacts.py first.")
        return []
    return contacts

def generate_phone_number():
    """Generate a phone number with the same format (13 digits starting with 573)"""
    return f"573{random.randint(1000000000, 9999999999)}"

def generate_payload(contact=None):
    """Generate a unique payload for each request"""
    if contact:
        phone_number = contact['phone']
        name = contact['name']
    else:
        phone_number = generate_phone_number()
        name = fake.name()
    
    timestamp = str(int(time.time()))
    
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "353047211225611",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "573158098705",
                                "phone_number_id": "384218374765023"
                            },
                            "contacts": [
                                {
                                    "profile": {
                                        "name": name
                                    },
                                    "wa_id": phone_number
                                }
                            ],
                            "messages": [
                                {
                                    "from": phone_number,
                                    "id": f"wamid.HBgMNTczMTgzODkwMzM3FQIAEhgWM0VCMENDQ0ZEMDUwQkNGNzc3M0U0MQA=",
                                    "timestamp": timestamp,
                                    "text": {
                                        "body": f"Test message from {name}"
                                    },
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    return payload, name, phone_number

def send_request(request_id, contact=None):
    """Send a single request to the endpoint"""
    payload, name, phone_number = generate_payload(contact)
    
    try:
        response = requests.post(URL, headers=HEADERS, json=payload, timeout=30)
        return {
            "id": request_id,
            "status": response.status_code,
            "name": name,
            "phone": phone_number,
            "success": response.status_code == 200,
            "response": response.text[:100] if response.text else ""
        }
    except Exception as e:
        return {
            "id": request_id,
            "status": "ERROR",
            "name": name,
            "phone": phone_number,
            "success": False,
            "error": str(e)
        }

def main():
    """Execute multiple concurrent requests"""
    # Load contacts from file
    contacts = load_contacts()
    
    if not contacts:
        print("No contacts available. Exiting.")
        return
    
    num_requests = min(200, len(contacts))  # Use up to 50 contacts or all available
    max_workers = 10  # Number of concurrent requests
    
    print(f"Starting load test with {num_requests} requests...")
    print(f"Endpoint: {URL}")
    print(f"Concurrent workers: {max_workers}\n")
    
    start_time = time.time()
    results = []
    
    # Execute requests concurrently using contacts
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(send_request, i+1, contacts[i % len(contacts)]) for i in range(num_requests)]
        
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            
            status_symbol = "✓" if result["success"] else "✗"
            print(f"{status_symbol} Request {result['id']}: {result['name']} ({result['phone']}) - Status: {result['status']}")
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Summary
    successful = sum(1 for r in results if r["success"])
    failed = num_requests - successful
    
    print(f"\n{'='*60}")
    print(f"LOAD TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Total requests: {num_requests}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Duration: {duration:.2f} seconds")
    print(f"Requests/second: {num_requests/duration:.2f}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
