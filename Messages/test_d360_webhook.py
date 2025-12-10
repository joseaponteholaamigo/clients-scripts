#!/usr/bin/env python3
"""
Script para simular peticiones simultáneas al webhook D360
Genera payloads con números aleatorios y los envía en paralelo
"""

import requests
import json
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import uuid

# Configuración
# BASE_URL = "http://ibang-middlewareqa.ibang.ai"
BASE_URL = "http://localhost:5003"

ACCESS_KEY = "DbFLPlivbTPss_wxR9r53g"
# ACCESS_KEY = "tMQ78O_VOCEIl_CygYl0sA"

WEBHOOK_URL = f"{BASE_URL}/api/v1.0/Webhook/D360?access_key={ACCESS_KEY}"

NUM_USERS = 20  # Número de usuarios diferentes
REPETITIONS_PER_USER = 1  # Repeticiones por usuario (al mismo tiempo)
MAX_WORKERS = 1   # Threads concurrentes 

# Tipos de mensajes de Dialog360
MESSAGE_TYPES = ["text"]

def generate_random_phone():
    return f"57318{random.randint(1000000, 9999999)}"
    # return f"573183890337"

def generate_text_message(phone_number=None):
    wa_id = phone_number if phone_number else generate_random_phone()
    user_names = ["Jose Aponte", "Maria Garcia", "Carlos Lopez", "Ana Martinez", "Luis Rodriguez", 
                  "Sofia Hernandez", "Pedro Gomez", "Laura Torres", "Miguel Sanchez", "Isabella Ramirez"]
    
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": str(random.randint(100000000000000, 999999999999999)),
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "573155039852",
                                "phone_number_id": "384218374765023"
                            },
                            "contacts": [
                                {
                                    "profile": {
                                        "name": random.choice(user_names)
                                    },
                                    "wa_id": wa_id
                                }
                            ],
                            "messages": [
                                {
                                    "from": wa_id,
                                    "id": f"wamid.{uuid.uuid4().hex.upper()}",
                                    "timestamp": str(int(time.time())),
                                    "text": {
                                        "body": f"Mensaje de prueba #{random.randint(1, 10000)}"
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

def send_webhook_request(request_id, payload):
    """Envía una petición al webhook y retorna el resultado"""
    start_time = time.time()
    
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Dialog360-Simulator/1.0"
        }
        
        response = requests.post(
            WEBHOOK_URL,
            json=payload,
            headers=headers,
            timeout=30
        )
        
        elapsed = time.time() - start_time
        
        return {
            "request_id": request_id,
            "status_code": response.status_code,
            "elapsed_time": elapsed,
            "success": response.status_code == 200,
            "payload_type": payload.get("messages", [{}])[0].get("type", "status") if "messages" in payload else "status",
            "phone": payload.get("messages", [{}])[0].get("from", "N/A") if "messages" in payload else "N/A",
            "response": response.text[:100] if response.text else ""
        }
    
    except requests.exceptions.Timeout:
        return {
            "request_id": request_id,
            "status_code": 0,
            "elapsed_time": time.time() - start_time,
            "success": False,
            "error": "TIMEOUT",
            "payload_type": "unknown",
            "phone": "N/A"
        }
    except Exception as e:
        return {
            "request_id": request_id,
            "status_code": 0,
            "elapsed_time": time.time() - start_time,
            "success": False,
            "error": str(e),
            "payload_type": "unknown",
            "phone": "N/A"
        }

def main():
    """Función principal"""
    total_requests = NUM_USERS * REPETITIONS_PER_USER
    
    print("=" * 80)
    print(f"🚀 SIMULADOR DE WEBHOOKS D360 - CARGA SIMULTÁNEA TOTAL")
    print("=" * 80)
    print(f"URL: {WEBHOOK_URL}")
    print(f"Usuarios diferentes: {NUM_USERS}")
    print(f"Repeticiones por usuario: {REPETITIONS_PER_USER} (simultáneas)")
    print(f"Total de peticiones: {total_requests} (TODAS AL MISMO TIEMPO)")
    print(f"Workers concurrentes: {MAX_WORKERS}")
    print("=" * 80)
    print()
    
    # Generar TODOS los usuarios y sus números de teléfono
    print("📦 Generando usuarios y payloads...")
    all_payloads = []
    user_phones = {}
    
    for user_num in range(1, NUM_USERS + 1):
        phone_number = generate_random_phone()
        user_phones[user_num] = phone_number
        
        # Generar REPETITIONS_PER_USER payloads para este usuario
        for rep in range(REPETITIONS_PER_USER):
            payload = generate_text_message(phone_number)
            all_payloads.append({
                'payload': payload,
                'user_number': user_num,
                'phone': phone_number,
                'repetition': rep + 1
            })
    
    print(f"✅ {len(all_payloads)} payloads generados ({NUM_USERS} usuarios × {REPETITIONS_PER_USER} repeticiones)")
    print()
    
    for user_num, phone in user_phones.items():
        print(f"   Usuario #{user_num}: {phone}")
    print()
    
    # Enviar TODAS las peticiones AL MISMO TIEMPO
    print(f"🔥 Enviando {total_requests} peticiones SIMULTÁNEAS...")
    print(f"   (Todos los usuarios y todas las repeticiones al mismo tiempo)")
    print()
    
    start_time = time.time()
    all_results = []
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for idx, item in enumerate(all_payloads, 1):
            future = executor.submit(send_webhook_request, idx, item['payload'])
            futures[future] = {
                'index': idx,
                'user_number': item['user_number'],
                'phone': item['phone'],
                'repetition': item['repetition']
            }
        
        for future in as_completed(futures):
            result = future.result()
            metadata = futures[future]
            result['user_number'] = metadata['user_number']
            result['phone'] = metadata['phone']
            result['repetition'] = metadata['repetition']
            all_results.append(result)
            
            # Mostrar progreso
            status_icon = "✅" if result["success"] else "❌"
            print(f"{status_icon} Request #{result['request_id']:03d}/{total_requests} | "
                  f"Usuario #{metadata['user_number']} ({metadata['phone']}) | "
                  f"Rep {metadata['repetition']}/{REPETITIONS_PER_USER} | "
                  f"Status: {result['status_code']} | "
                  f"Time: {result['elapsed_time']:.3f}s")
    
    total_time = time.time() - start_time
    
    # Estadísticas GLOBALES
    print()
    print("=" * 80)
    print("📊 ESTADÍSTICAS GLOBALES")
    print("=" * 80)
    
    successful = sum(1 for r in all_results if r["success"])
    failed = len(all_results) - successful
    avg_time = sum(r["elapsed_time"] for r in all_results) / len(all_results) if all_results else 0
    
    print(f"👥 Total usuarios: {NUM_USERS}")
    print(f"� Repeticiones por usuario: {REPETITIONS_PER_USER}")
    print(f"📨 Total peticiones: {total_requests}")
    print(f"⏱️  Tiempo total: {total_time:.2f}s")
    print(f"⏱️  Tiempo total: {total_time:.2f}s")
    print(f"✅ Exitosas: {successful}/{total_requests} ({successful/total_requests*100:.1f}%)")
    print(f"❌ Fallidas: {failed}/{total_requests} ({failed/total_requests*100:.1f}%)")
    print(f"⚡ Promedio por request: {avg_time:.3f}s")
    print(f"🚀 Requests por segundo: {total_requests/total_time:.2f}")
    print()
    
    # Estadísticas por usuario
    print("📈 Por usuario:")
    for user_num in range(1, NUM_USERS + 1):
        user_results = [r for r in all_results if r.get('user_number') == user_num]
        if user_results:
            user_phone = user_results[0]['phone']
            user_success = sum(1 for r in user_results if r["success"])
            success_rate = (user_success / len(user_results) * 100) if user_results else 0
            print(f"  Usuario #{user_num} ({user_phone}): {user_success}/{len(user_results)} ({success_rate:.1f}%)")
    print()
    
    # Mostrar errores si hay
    errors = [r for r in all_results if not r["success"]]
    if errors:
        print("⚠️  ERRORES ENCONTRADOS:")
        for err in errors[:10]:  # Mostrar solo los primeros 10
            error_msg = err.get("error", f"HTTP {err['status_code']}")
            user_info = f"Usuario #{err.get('user_number', '?')} - {err.get('phone', 'N/A')}"
            print(f"  {user_info} Request #{err['request_id']}: {error_msg}")
        if len(errors) > 10:
            print(f"  ... y {len(errors) - 10} errores más")
        print()
    
    print("=" * 80)
    print("✨ Prueba completada")
    print("=" * 80)

if __name__ == "__main__":
    main()
