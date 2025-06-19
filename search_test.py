#!/usr/bin/env python3
import httpx
import asyncio
import json
import os
import uuid
from datetime import datetime

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://0edfc63a-4e45-481a-99e5-cc9a9ce190c6.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"

# Timeout settings
TIMEOUT = 60.0  # 60 seconds timeout for API calls

async def test_business_search_api():
    """Test the business search API with a real search"""
    print("\n🔍 Testing Business Search API with real search...")
    
    search_data = {
        "business_type": "restaurant",
        "location": "New York, NY",
        "radius": 2.0
    }
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            print(f"Sending search request for {search_data['business_type']} in {search_data['location']}...")
            response = await client.post(
                f"{API_URL}/search-businesses", 
                json=search_data
            )
            
            if response.status_code == 200:
                data = response.json()
                businesses = data.get("businesses", [])
                
                print(f"✅ Search successful: Found {len(businesses)} businesses")
                print(f"✅ Search location: {data.get('search_location')}")
                
                if businesses:
                    sample = businesses[0]
                    print(f"\nSample business:")
                    print(f"  • Name: {sample.get('name')}")
                    print(f"  • Type: {sample.get('business_type')}")
                    print(f"  • Address: {sample.get('address')}")
                    print(f"  • Quality Score: {sample.get('quality_score')}")
                    print(f"  • Lead Status: {sample.get('lead_status')}")
                    
                    # Check lead status classification
                    score = sample.get('quality_score')
                    status = sample.get('lead_status')
                    
                    expected_status = "unqualified"
                    if score >= 80:
                        expected_status = "hot"
                    elif score >= 60:
                        expected_status = "warm"
                    elif score >= 40:
                        expected_status = "cold"
                    
                    if status == expected_status:
                        print(f"✅ Correct lead status: {status} (score: {score})")
                    else:
                        print(f"❌ Incorrect lead status: got {status}, expected {expected_status} (score: {score})")
                
                return True
            else:
                print(f"❌ Search failed: {response.text}")
                return False
    except Exception as e:
        print(f"❌ Search error: {str(e)}")
        return False

if __name__ == "__main__":
    asyncio.run(test_business_search_api())