import random
from faker import Faker

fake = Faker()

def generate_phone_number():
    """Generate a phone number with the same format (13 digits starting with 573)"""
    return f"573{random.randint(1000000000, 9999999999)}"

def generate_contacts(num_contacts=100):
    """Generate fake contacts and save them to a text file"""
    contacts = []
    phone_numbers = set()  # To avoid duplicates
    
    print(f"Generating {num_contacts} fake contacts...")
    
    while len(contacts) < num_contacts:
        phone = generate_phone_number()
        
        # Ensure unique phone numbers
        if phone not in phone_numbers:
            name = fake.name()
            phone_numbers.add(phone)
            contacts.append(f"{phone},{name}")
    
    # Save to file
    with open('fake_contacts.txt', 'w', encoding='utf-8') as f:
        for contact in contacts:
            f.write(contact + '\n')
    
    print(f"✓ Successfully generated {len(contacts)} contacts!")
    print(f"✓ Saved to fake_contacts.txt")
    print(f"\nSample contacts:")
    for i, contact in enumerate(contacts[:5], 1):
        phone, name = contact.split(',')
        print(f"  {i}. {name} - {phone}")

if __name__ == "__main__":
    # Generate 500 contacts by default, you can change this number
    num = 1000
    generate_contacts(num)
