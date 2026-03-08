#!/bin/bash

# 🗑️ Test Cache Clear Script for Renewals API
# This script demonstrates how to clear the renewal cache

BASE_URL="http://localhost:4020/api/renewals"

echo "🧪 Testing Renewals Cache Management"
echo "===================================="
echo ""

# Test 1: Get renewals (will cache)
echo "1️⃣ Fetching renewals (will be cached)..."
curl -s "$BASE_URL" | jq '.meta.cached'
echo ""

# Test 2: Get renewals again (should be from cache)
echo "2️⃣ Fetching renewals again (should be cached)..."
curl -s "$BASE_URL" | jq '.meta.cached'
echo ""

# Test 3: Clear cache
echo "3️⃣ Clearing cache..."
curl -s -X POST "$BASE_URL/cache/clear" | jq '.'
echo ""

# Test 4: Get renewals after clear (should NOT be cached)
echo "4️⃣ Fetching renewals after cache clear (should NOT be cached)..."
curl -s "$BASE_URL" | jq '.meta.cached'
echo ""

# Test 5: Get renewals again (should be cached again)
echo "5️⃣ Fetching renewals again (should be cached now)..."
curl -s "$BASE_URL" | jq '.meta.cached'
echo ""

echo "✅ Cache test complete!"
echo ""
echo "Expected results:"
echo "  Step 1: false (first fetch, not cached)"
echo "  Step 2: true (cached)"
echo "  Step 3: success message"
echo "  Step 4: false (cache cleared, fresh fetch)"
echo "  Step 5: true (cached again)"