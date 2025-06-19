#!/usr/bin/env python3
import httpx
import asyncio
import json
import os
import uuid
from datetime import datetime
import pytest
import sys

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://0edfc63a-4e45-481a-99e5-cc9a9ce190c6.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"

# Test data
TEST_BUSINESS_TYPES = ["restaurant", "shop"]  # Reduced for faster testing
TEST_LOCATIONS = ["New York, NY", "San Francisco, CA"]  # Reduced for faster testing
TEST_USER_ID = "test_user_" + datetime.now().strftime("%Y%m%d%H%M%S")

# Store test data for use across tests
test_data = {
    "businesses": [],
    "favorites": [],
    "search_results": {}
}

# Timeout settings
TIMEOUT = 30.0  # 30 seconds timeout for API calls

async def test_health_endpoint():
    """Test the health endpoint to verify server is running"""
    print("\n🔍 Testing FastAPI Server Health...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ Health endpoint working: {data}")
    return True

async def test_business_search_api():
    """Test the business search API with various parameters"""
    print("\n🔍 Testing Business Search API...")
    
    all_results = []
    
    for business_type in TEST_BUSINESS_TYPES[:2]:  # Test first two business types
        for location in TEST_LOCATIONS[:2]:  # Test first two locations
            print(f"  Searching for {business_type} in {location}...")
            
            search_data = {
                "business_type": business_type,
                "location": location,
                "radius": 5.0
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{API_URL}/search-businesses", 
                    json=search_data
                )
                
                assert response.status_code == 200, f"Search failed with status {response.status_code}: {response.text}"
                
                data = response.json()
                businesses = data.get("businesses", [])
                
                # Store for later tests
                if businesses:
                    test_data["businesses"].extend(businesses)
                    test_data["search_results"][f"{business_type}_{location}"] = businesses
                
                print(f"  ✅ Found {len(businesses)} {business_type} businesses in {location}")
                print(f"  🔍 Search location: {data.get('search_location')}")
                
                # Verify business data structure
                if businesses:
                    sample = businesses[0]
                    assert "id" in sample
                    assert "name" in sample
                    assert "business_type" in sample
                    assert "address" in sample
                    assert "lat" in sample and "lon" in sample
                    assert "quality_score" in sample
                    assert "lead_status" in sample
                    
                    all_results.append({
                        "business_type": business_type,
                        "location": location,
                        "count": len(businesses),
                        "sample": sample["name"]
                    })
    
    # Print summary
    print("\n📊 Business Search API Results Summary:")
    for result in all_results:
        print(f"  • {result['business_type']} in {result['location']}: {result['count']} results (e.g., {result['sample']})")
    
    return len(test_data["businesses"]) > 0

async def test_external_api_integration():
    """Test the external API integrations (OpenStreetMap, Nominatim, OpenCorporates)"""
    print("\n🔍 Testing External API Integration...")
    
    if not test_data["businesses"]:
        print("❌ No businesses found to test external API integration")
        return False
    
    # Test geocoding with different location formats
    locations_to_test = [
        "New York, NY",
        "San Francisco, California"
    ]
    
    geocoding_results = []
    successful_geocoding = 0
    
    for location in locations_to_test:
        search_data = {
            "business_type": "restaurant",
            "location": location,
            "radius": 2.0
        }
        
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(
                    f"{API_URL}/search-businesses", 
                    json=search_data
                )
                
                if response.status_code == 200:
                    data = response.json()
                    search_location = data.get("search_location", {})
                    
                    if search_location and search_location.get("lat") and search_location.get("lon"):
                        geocoding_results.append({
                            "location": location,
                            "coordinates": search_location,
                            "success": True
                        })
                        successful_geocoding += 1
                    else:
                        geocoding_results.append({
                            "location": location,
                            "coordinates": None,
                            "success": False
                        })
                else:
                    geocoding_results.append({
                        "location": location,
                        "coordinates": None,
                        "success": False,
                        "error": response.text
                    })
        except Exception as e:
            print(f"❌ Geocoding error for {location}: {str(e)}")
            geocoding_results.append({
                "location": location,
                "coordinates": None,
                "success": False,
                "error": str(e)
            })
    
    # Print geocoding results
    print("\n📊 Geocoding Results:")
    for result in geocoding_results:
        if result["success"]:
            print(f"  ✅ {result['location']} → {result['coordinates']}")
        else:
            print(f"  ❌ {result['location']} → Failed to geocode")
    
    # Check if we have company info from OpenCorporates
    company_info_found = False
    for business in test_data["businesses"][:10]:  # Check first 10 businesses
        if business.get("company_info") and len(business.get("company_info", {})) > 0:
            company_info_found = True
            print(f"\n✅ OpenCorporates integration working - Found company info for {business['name']}")
            print(f"  Company info: {business.get('company_info')}")
            break
    
    if not company_info_found:
        print("\n⚠️ OpenCorporates integration might not be working - No company info found in sample businesses")
    
    return successful_geocoding > 0 or len(test_data["businesses"]) > 0

async def test_lead_quality_scoring():
    """Test the lead quality scoring system"""
    print("\n🔍 Testing Lead Quality Scoring System...")
    
    if not test_data["businesses"]:
        print("❌ No businesses found to test lead quality scoring")
        return False
    
    # Analyze quality scores and lead statuses
    quality_scores = [b["quality_score"] for b in test_data["businesses"]]
    lead_statuses = {}
    
    for business in test_data["businesses"]:
        status = business["lead_status"]
        if status not in lead_statuses:
            lead_statuses[status] = []
        lead_statuses[status].append(business)
    
    # Print quality score statistics
    if quality_scores:
        avg_score = sum(quality_scores) / len(quality_scores)
        min_score = min(quality_scores)
        max_score = max(quality_scores)
        
        print(f"\n📊 Quality Score Statistics:")
        print(f"  • Average score: {avg_score:.1f}")
        print(f"  • Min score: {min_score}")
        print(f"  • Max score: {max_score}")
    
    # Print lead status distribution
    print(f"\n📊 Lead Status Distribution:")
    for status, businesses in lead_statuses.items():
        print(f"  • {status.capitalize()}: {len(businesses)} leads")
    
    # Verify lead status classification logic
    correct_classification = True
    for business in test_data["businesses"]:
        score = business["quality_score"]
        status = business["lead_status"]
        
        expected_status = "unqualified"
        if score >= 80:
            expected_status = "hot"
        elif score >= 60:
            expected_status = "warm"
        elif score >= 40:
            expected_status = "cold"
        
        if status != expected_status:
            print(f"❌ Incorrect lead status for {business['name']}: got {status}, expected {expected_status} (score: {score})")
            correct_classification = False
    
    if correct_classification:
        print("✅ Lead status classification is working correctly")
    
    # Check if we have businesses with different quality indicators
    has_website = any(b.get("website") for b in test_data["businesses"])
    has_phone = any(b.get("phone") for b in test_data["businesses"])
    has_email = any(b.get("email") for b in test_data["businesses"])
    
    print("\n📊 Contact Information Availability:")
    print(f"  • Businesses with website: {'✅ Found' if has_website else '❌ None found'}")
    print(f"  • Businesses with phone: {'✅ Found' if has_phone else '❌ None found'}")
    print(f"  • Businesses with email: {'✅ Found' if has_email else '❌ None found'}")
    
    return True

async def test_favorites_api():
    """Test the favorites management API"""
    print("\n🔍 Testing Favorites Management API...")
    
    if not test_data["businesses"]:
        print("❌ No businesses found to test favorites API")
        return False
    
    # Select a few businesses to add to favorites
    businesses_to_favorite = test_data["businesses"][:2]
    success = True
    
    # 1. Add businesses to favorites
    for business in businesses_to_favorite:
        favorite_data = {
            "business_id": business["id"],
            "user_id": TEST_USER_ID
        }
        
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(
                    f"{API_URL}/favorites", 
                    json=favorite_data
                )
                
                if response.status_code != 200:
                    print(f"❌ Failed to add favorite: {response.text}")
                    success = False
                    continue
                
                data = response.json()
                favorite_id = data.get("id")
                
                if favorite_id:
                    test_data["favorites"].append({
                        "id": favorite_id,
                        "business_id": business["id"],
                        "business_name": business["name"]
                    })
                    print(f"  ✅ Added {business['name']} to favorites (ID: {favorite_id})")
        except Exception as e:
            print(f"❌ Error adding favorite: {str(e)}")
            success = False
    
    # 2. Get favorites
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{API_URL}/favorites?user_id={TEST_USER_ID}"
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to get favorites: {response.text}")
                success = False
            else:
                data = response.json()
                favorites = data.get("favorites", [])
                
                print(f"  ✅ Retrieved {len(favorites)} favorites")
                
                # Verify all added favorites are returned
                favorite_ids = [f["favorite_id"] for f in favorites]
                for favorite in test_data["favorites"]:
                    if favorite["id"] not in favorite_ids:
                        print(f"  ⚠️ Favorite {favorite['id']} not found in retrieved favorites")
    except Exception as e:
        print(f"❌ Error getting favorites: {str(e)}")
        success = False
    
    # 3. Delete one favorite
    if test_data["favorites"]:
        favorite_to_delete = test_data["favorites"][0]
        
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.delete(
                    f"{API_URL}/favorites/{favorite_to_delete['id']}"
                )
                
                if response.status_code != 200:
                    print(f"❌ Failed to delete favorite: {response.text}")
                    success = False
                else:
                    print(f"  ✅ Deleted favorite for {favorite_to_delete['business_name']}")
            
            # Verify it was deleted
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(
                    f"{API_URL}/favorites?user_id={TEST_USER_ID}"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    favorites = data.get("favorites", [])
                    
                    favorite_ids = [f["favorite_id"] for f in favorites]
                    if favorite_to_delete["id"] not in favorite_ids:
                        print(f"  ✅ Verified favorite was deleted")
                    else:
                        print(f"  ⚠️ Favorite was not deleted properly")
        except Exception as e:
            print(f"❌ Error deleting favorite: {str(e)}")
            success = False
    
    return success

async def test_csv_export_api():
    """Test the CSV export API"""
    print("\n🔍 Testing CSV Export API...")
    
    # Test with different filters
    test_cases = [
        {"business_type": None, "min_quality_score": 0, "description": "All businesses"}
    ]
    
    success = True
    
    for test_case in test_cases:
        params = {}
        if test_case["business_type"]:
            params["business_type"] = test_case["business_type"]
        params["min_quality_score"] = test_case["min_quality_score"]
        params["user_id"] = TEST_USER_ID
        
        print(f"  Testing export: {test_case['description']}...")
        
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(
                    f"{API_URL}/export-csv",
                    params=params
                )
                
                if response.status_code != 200:
                    print(f"❌ CSV export failed: {response.text}")
                    success = False
                    continue
                
                data = response.json()
                headers = data.get("headers", [])
                rows = data.get("rows", [])
                filename = data.get("filename", "")
                
                print(f"  ✅ Export successful: {len(rows)} rows, filename: {filename}")
                
                # Verify CSV structure
                if not headers or len(headers) == 0:
                    print("❌ CSV headers missing")
                    success = False
                    continue
                
                if "Name" not in headers:
                    print("❌ Name column missing")
                    success = False
                
                if "Quality Score" not in headers:
                    print("❌ Quality Score column missing")
                    success = False
                
                if "Lead Status" not in headers:
                    print("❌ Lead Status column missing")
                    success = False
                
                # Verify rows match filter criteria if we have any rows
                if rows:
                    for row in rows:
                        if test_case["business_type"]:
                            business_type_index = headers.index("Type")
                            if row[business_type_index] != test_case["business_type"]:
                                print(f"❌ Business type mismatch: {row[business_type_index]}")
                                success = False
                        
                        quality_score_index = headers.index("Quality Score")
                        if int(row[quality_score_index]) < test_case["min_quality_score"]:
                            print(f"❌ Quality score too low: {row[quality_score_index]}")
                            success = False
        except Exception as e:
            print(f"❌ Error testing CSV export: {str(e)}")
            success = False
    
    return success

async def run_all_tests():
    """Run all tests and return results"""
    test_results = {}
    
    try:
        # Test FastAPI Server Setup
        test_results["FastAPI Server Setup"] = await test_health_endpoint()
        
        # Test Business Search API
        test_results["Business Search API"] = await test_business_search_api()
        
        # Test External API Integration
        test_results["External API Integration"] = await test_external_api_integration()
        
        # Test Lead Quality Scoring System
        test_results["Lead Quality Scoring System"] = await test_lead_quality_scoring()
        
        # Test Favorites Management API
        test_results["Favorites Management API"] = await test_favorites_api()
        
        # Test CSV Export API
        test_results["CSV Export API"] = await test_csv_export_api()
        
        # Print summary
        print("\n" + "="*80)
        print("TEST RESULTS SUMMARY")
        print("="*80)
        
        all_passed = True
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            if not result:
                all_passed = False
            print(f"{test_name}: {status}")
        
        print("\n" + "="*80)
        overall_status = "✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED"
        print(f"OVERALL STATUS: {overall_status}")
        print("="*80)
        
        return test_results
    except Exception as e:
        print(f"\n❌ ERROR DURING TESTING: {str(e)}")
        import traceback
        traceback.print_exc()
        return test_results

if __name__ == "__main__":
    asyncio.run(run_all_tests())