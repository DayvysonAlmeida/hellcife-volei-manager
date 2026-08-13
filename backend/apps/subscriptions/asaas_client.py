import requests
import json
from django.conf import settings

class AsaasClient:
    def __init__(self):
        self.api_url = settings.ASAAS_API_URL
        self.api_key = settings.ASAAS_API_KEY
        self.headers = {
            'Content-Type': 'application/json',
            'access_token': self.api_key
        }

    def create_customer(self, name, cpfCnpj, email, phone=None):
        if not self.api_key:
            return {"id": "cus_mock_" + cpfCnpj[:6], "object": "customer"}
            
        url = f"{self.api_url}/customers"
        payload = {
            "name": name,
            "cpfCnpj": cpfCnpj,
            "email": email,
        }
        if phone:
            payload["mobilePhone"] = phone

        response = requests.post(url, json=payload, headers=self.headers)
        if response.status_code in [200, 201]:
            return response.json()
        
        error_msg = response.text
        try:
            error_msg = response.json().get('errors', [{}])[0].get('description', response.text)
        except:
            pass
        raise Exception(f"Asaas Error ({response.status_code}): {error_msg}")

    def create_subscription(self, customer_id, value, nextDueDate, description):
        if not self.api_key:
            return {
                "id": "sub_mock_" + customer_id[-6:],
                "invoiceUrl": "https://sandbox.asaas.com/mock/invoice/sub"
            }
            
        url = f"{self.api_url}/subscriptions"
        payload = {
            "customer": customer_id,
            "billingType": "PIX",
            "nextDueDate": nextDueDate,
            "value": value,
            "cycle": "MONTHLY",
            "description": description
        }
        response = requests.post(url, json=payload, headers=self.headers)
        if response.status_code in [200, 201]:
            return response.json()
            
        error_msg = response.text
        try:
            error_msg = response.json().get('errors', [{}])[0].get('description', response.text)
        except:
            pass
        raise Exception(f"Asaas Error ({response.status_code}): {error_msg}")

    def create_payment(self, customer_id, value, dueDate, description):
        if not self.api_key:
            return {
                "id": "pay_mock_" + customer_id[-6:],
                "invoiceUrl": "https://sandbox.asaas.com/mock/invoice/pay"
            }
            
        url = f"{self.api_url}/payments"
        payload = {
            "customer": customer_id,
            "billingType": "PIX",
            "dueDate": dueDate,
            "value": value,
            "description": description
        }
        response = requests.post(url, json=payload, headers=self.headers)
        if response.status_code in [200, 201]:
            return response.json()
            
        error_msg = response.text
        try:
            error_msg = response.json().get('errors', [{}])[0].get('description', response.text)
        except:
            pass
        raise Exception(f"Asaas Error ({response.status_code}): {error_msg}")

    def get_pix_qr_code(self, payment_id):
        if not self.api_key:
            return {
                "payload": "00020101021226500014br.gov.bcb.pix0128mock@hellcife.com5204000053039865802BR5915Mock Pagamento6006Recife62070503***6304MOCK"
            }
            
        url = f"{self.api_url}/payments/{payment_id}/pixQrCode"
        response = requests.get(url, headers=self.headers)
        if response.status_code in [200, 201]:
            return response.json()
            
        error_msg = response.text
        try:
            error_msg = response.json().get('errors', [{}])[0].get('description', response.text)
        except:
            pass
        raise Exception(f"Asaas Error ({response.status_code}): {error_msg}")

    def get_subscription(self, subscription_id):
        url = f"{self.api_url}/subscriptions/{subscription_id}"
        response = requests.get(url, headers=self.headers)
        if response.status_code == 200:
            return response.json()
        response.raise_for_status()
