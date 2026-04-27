import random
import logging
from datetime import datetime, timedelta
from typing import Optional
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

class OTPService:
    @staticmethod
    def generate_code() -> str:
        """Generate a 6-digit numeric OTP"""
        return "".join([str(random.randint(0, 9)) for _ in range(6)])

    @staticmethod
    async def send_otp(target: str, code: str, target_type: str = "phone") -> bool:
        """
        Send OTP via preferred provider based on target_type.
        Returns True if sent successfully.
        """
        if settings.NODE_ENV == "development":
            logger.info(f"DEBUG: Sent OTP {code} to {target} via {target_type}")
            return True

        if target_type == "phone":
            return await OTPService._send_sms_twilio(target, code)
        else:
            return await OTPService._send_email_placeholder(target, code)

    @staticmethod
    async def _send_sms_twilio(phone: str, code: str) -> bool:
        """Send SMS via Twilio API"""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.error("Twilio credentials not configured")
            return False

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        data = {
            "From": settings.TWILIO_PHONE,
            "To": phone,
            "Body": f"Your Kitti Platform access code is: {code}. It expires in 10 minutes."
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    data=data,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                )
                if response.status_code in [200, 201]:
                    logger.info(f"Twilio SMS sent to {phone}")
                    return True
                else:
                    logger.error(f"Twilio error: {response.text}")
                    return False
            except Exception as e:
                logger.error(f"Twilio request failed: {str(e)}")
                return False

    @staticmethod
    async def _send_email_placeholder(email: str, code: str) -> bool:
        """Placeholder for email provider (e.g. SendGrid, Mailgun)"""
        logger.info(f"Email integration pending: {code} to {email}")
        # Implement real email logic here
        return True
